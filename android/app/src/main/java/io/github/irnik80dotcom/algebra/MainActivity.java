package io.github.irnik80dotcom.algebra;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Algebra gyakorló — a webes gyakorló beágyazva egy WebView-ba.
 *
 * Frissítés APK nélkül: induláskor a gyakorló fájljait a weboldalról (GitHub Pages) tölti le,
 * és elmenti őket. Ha nincs net, a legutóbb letöltött példányt, végső esetben az APK-ba
 * beépítettet használja. A WebView „címe” mindig ugyanaz marad (appassets…), így a
 * gyerek eredményei (localStorage) a frissítések után is megmaradnak.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/assets/www/index.html";
    private static final int PICK_FILE = 1001;
    private static final String PREFIX = "/assets/www/";
    private static final String REMOTE = "https://irnik80-dotcom.github.io/algebra-gyakorlo/";

    /** Az aktuális oldalbetöltésnél elérhető-e a weboldal (ha az index.html nem jött le, a többit sem próbáljuk). */
    private volatile boolean onlineThisLoad = false;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);

        // a rendszersávok és a billentyűzet ne takarják ki a tartalmat
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // localStorage (pontszám, beállítások)
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setUserAgentString(s.getUserAgentString() + " AlgebraGyakorloApp/" + BuildConfigVersion.NAME);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith(PREFIX)
                        && "GET".equalsIgnoreCase(req.getMethod())) {
                    WebResourceResponse r = fromWebOrCache(u, req.isForMainFrame());
                    if (r != null) return r;
                }
                return loader.shouldInterceptRequest(u);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                // külső linkek (pl. Google AI Studio) a böngészőben nyílnak meg
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                return openChooser(params);
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START_URL);
    }

    // ---------- frissítés a weboldalról ----------
    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html"); MIME.put("js", "application/javascript"); MIME.put("css", "text/css");
        MIME.put("json", "application/json"); MIME.put("webmanifest", "application/manifest+json");
        MIME.put("png", "image/png"); MIME.put("svg", "image/svg+xml");
    }

    private WebResourceResponse fromWebOrCache(Uri u, boolean mainFrame) {
        String rel = u.getPath().substring(PREFIX.length());
        if (rel.isEmpty()) rel = "index.html";
        if (rel.contains("..")) return null;
        int dot = rel.lastIndexOf('.');
        String mime = MIME.get(dot >= 0 ? rel.substring(dot + 1) : "");
        if (mime == null) return null;
        File cached = new File(new File(getFilesDir(), "www"), rel);

        boolean isIndex = rel.equals("index.html");
        if (isIndex || mainFrame) onlineThisLoad = false;
        if (isIndex || onlineThisLoad) {
            byte[] body = download(REMOTE + rel + (u.getQuery() != null ? "?" + u.getQuery() : ""), isIndex ? 4000 : 8000);
            if (body != null && body.length > 0) {
                if (isIndex) onlineThisLoad = true;
                save(cached, body);
                return response(mime, new ByteArrayInputStream(body));
            }
        }
        if (cached.isFile()) {
            try { return response(mime, new FileInputStream(cached)); } catch (Exception ignored) { }
        }
        return null; // → az APK-ba beépített példány
    }

    private static byte[] download(String url, int timeoutMs) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(timeoutMs);
            c.setReadTimeout(timeoutMs);
            c.setUseCaches(false);
            c.setRequestProperty("Cache-Control", "no-cache");
            if (c.getResponseCode() != 200) return null;
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                return out.toByteArray();
            }
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static void save(File f, byte[] body) {
        try {
            File dir = f.getParentFile();
            if (dir != null && !dir.exists()) dir.mkdirs();
            File tmp = new File(f.getPath() + ".tmp");
            try (FileOutputStream out = new FileOutputStream(tmp)) { out.write(body); }
            if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f); }
        } catch (Exception ignored) { }
    }

    private static WebResourceResponse response(String mime, InputStream in) {
        WebResourceResponse r = new WebResourceResponse(mime, "UTF-8", in);
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", "no-store");
        r.setResponseHeaders(h);
        return r;
    }

    /** Galéria / fájl + kamera választó a „Fotó a füzetről” gombhoz. */
    private boolean openChooser(WebChromeClient.FileChooserParams params) {
        Intent pick = params.createIntent();
        pick.setType("image/*");
        List<Intent> extra = new ArrayList<>();
        try {
            File dir = new File(getCacheDir(), "photos");
            if (!dir.exists()) dir.mkdirs();
            File photo = File.createTempFile("fuzet_", ".jpg", dir);
            cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", photo);
            Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            cam.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
            cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (cam.resolveActivity(getPackageManager()) != null) extra.add(cam);
        } catch (Exception e) {
            cameraUri = null;
        }
        Intent chooser = Intent.createChooser(pick, "Kép kiválasztása");
        if (!extra.isEmpty()) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, extra.toArray(new Intent[0]));
        try {
            startActivityForResult(chooser, PICK_FILE);
            return true;
        } catch (ActivityNotFoundException e) {
            fileCallback = null;
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == PICK_FILE && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK) {
                if (data != null && data.getData() != null) result = new Uri[]{data.getData()};
                else if (data != null && data.getClipData() != null && data.getClipData().getItemCount() > 0)
                    result = new Uri[]{data.getClipData().getItemAt(0).getUri()};
                else if (cameraUri != null) result = new Uri[]{cameraUri};
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        // ha nyitva van a beállítások ablak, a „vissza” azt zárja be; különben kilépés
        web.evaluateJavascript(
                "(function(){var d=document.getElementById('settings');" +
                "if(d&&d.open){d.close();return 'closed';}" +
                "var v=document.getElementById('view-own');" +
                "if(v&&!v.hidden){document.querySelector('.tab[data-view=practice]').click();return 'tab';}" +
                "return 'none';})()",
                r -> { if (r == null || r.contains("none")) finishAfterBack(); });
    }

    private void finishAfterBack() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() { super.onPause(); web.onPause(); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

    /** Verziószám a user-agenthez (a weboldal így tudja, hogy appban fut). */
    static final class BuildConfigVersion { static final String NAME = "1.2"; }
}
