package com.fastonmed.crm;

import android.os.Bundle;
import android.net.Uri;
import android.print.PrintManager;
import android.util.Base64;
import android.widget.Toast;
import android.webkit.WebView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.io.OutputStream;
import java.util.Collections;

public class MainActivity extends BridgeActivity {
    private byte[] pendingExport;
    private ActivityResultLauncher<String> saveFile;
    private String mobileScript;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        saveFile = registerForActivityResult(new ActivityResultContracts.CreateDocument("*/*"), uri -> {
            byte[] content = pendingExport;
            pendingExport = null;
            if (uri == null || content == null) return;
            try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                if (output == null) throw new java.io.IOException();
                output.write(content);
                Toast.makeText(this, "CRM export saved", Toast.LENGTH_SHORT).show();
            } catch (Exception error) {
                Toast.makeText(this, "Unable to save this export. Please retry.", Toast.LENGTH_LONG).show();
            }
        });
        try (java.io.InputStream stream = getAssets().open("public/crm-mobile-bridge.js")) {
            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int count;
            while ((count = stream.read(buffer)) != -1) bytes.write(buffer, 0, count);
            mobileScript = bytes.toString(StandardCharsets.UTF_8.name());
        } catch (Exception error) { mobileScript = ""; }
        WebView view = bridge.getWebView();
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(view, "FastonMedNative", Collections.singleton("https://crm.fastonmed.com"),
                (webView, message, origin, isMainFrame, reply) -> {
                    if (!isMainFrame || !"https".equals(origin.getScheme()) || !"crm.fastonmed.com".equals(origin.getHost())) return;
                    try {
                        String raw = message.getData();
                        if (raw == null || raw.length() > 28 * 1024 * 1024) throw new IllegalArgumentException();
                        JSONObject payload = new JSONObject(raw);
                        if ("print".equals(payload.optString("action"))) {
                            PrintManager manager = (PrintManager) getSystemService(PRINT_SERVICE);
                            manager.print("FastonMed CRM", view.createPrintDocumentAdapter("FastonMed CRM"), null);
                        } else if ("save".equals(payload.optString("action"))) {
                            if (pendingExport != null) { Toast.makeText(this, "Finish saving the current file first", Toast.LENGTH_SHORT).show(); return; }
                            byte[] data = Base64.decode(payload.getString("data"), Base64.DEFAULT);
                            if (data.length > 20 * 1024 * 1024) throw new IllegalArgumentException();
                            String name = payload.optString("name", "FastonMed-export").replaceAll("[^a-zA-Z0-9._ -]", "_");
                            pendingExport = data;
                            saveFile.launch(name.length() > 150 ? name.substring(0, 150) : name);
                        }
                    } catch (Exception error) {
                        pendingExport = null;
                        Toast.makeText(this, "Unable to export. Please retry from the CRM.", Toast.LENGTH_LONG).show();
                    }
                });
        }
        bridge.addWebViewListener(new WebViewListener() {
            @Override public void onPageLoaded(WebView webView) {
                Uri url = Uri.parse(webView.getUrl() == null ? "" : webView.getUrl());
                if ("https".equals(url.getScheme()) && "crm.fastonmed.com".equals(url.getHost())) webView.evaluateJavascript(mobileScript, null);
            }
        });
    }
}
