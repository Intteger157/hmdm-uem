package com.hmdm.control.janus.server;

import android.content.Context;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hmdm.control.BuildConfig;
import com.hmdm.control.Const;
import com.hmdm.control.SettingsHelper;

import java.net.MalformedURLException;
import java.net.URL;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.jackson.JacksonConverterFactory;

public class JanusServerApiFactory {
    private static JanusServerApi apiInstance;
    private static String secret;

    public static void resetApiInstance() {
        apiInstance = null;
        secret = null;
    }

    public static JanusServerApi getApiInstance(Context context) {
        if ( apiInstance == null ) {
            String configuredUrl = SettingsHelper.getInstance(context).getString(SettingsHelper.KEY_SERVER_URL);
            apiInstance = createServerService(resolveJanusBaseUrl(configuredUrl));
        }
        return apiInstance;
    }

    /**
     * Janus REST API lives at /janus on the remote host root, not under /web-admin/.
     */
    static String resolveJanusBaseUrl(String configuredUrl) {
        if (configuredUrl == null || configuredUrl.trim().isEmpty()) {
            return configuredUrl;
        }
        String url = configuredUrl.trim();
        if (!url.endsWith("/")) {
            url = url + "/";
        }
        if (!url.contains("/web-admin")) {
            return url;
        }
        try {
            URL parsed = new URL(url);
            int port = parsed.getPort();
            String portSuffix = port > 0 ? ":" + port : "";
            return parsed.getProtocol() + "://" + parsed.getHost() + portSuffix + "/";
        } catch (MalformedURLException e) {
            return url.replaceFirst("/web-admin/?$", "/");
        }
    }

    public static String getSecret(Context context) {
         if (secret == null) {
             secret = SettingsHelper.getInstance(context).getString(SettingsHelper.KEY_SECRET);
         }
         return secret;
    }

    private static JanusServerApi createServerService( String baseUrl ) {
        return createBuilder( baseUrl ).build().create( JanusServerApi.class );
    }

    private static Retrofit.Builder createBuilder(String baseUrl ) {
        HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
        logging.setLevel(BuildConfig.DEBUG ? HttpLoggingInterceptor.Level.BASIC : HttpLoggingInterceptor.Level.NONE);

        Retrofit.Builder builder = new Retrofit.Builder();

        OkHttpClient.Builder clientBuilder = new OkHttpClient.Builder().
                    addInterceptor(logging).
                    connectTimeout( Const.CONNECTION_TIMEOUT, TimeUnit.MILLISECONDS ).
                    readTimeout( Const.CONNECTION_TIMEOUT, TimeUnit.MILLISECONDS ).
                    writeTimeout( Const.CONNECTION_TIMEOUT, TimeUnit.MILLISECONDS );
        builder.client(clientBuilder.build());

        builder.baseUrl(baseUrl)
                .addConverterFactory(JacksonConverterFactory.create(new ObjectMapper()));

        return builder;
    }
}
