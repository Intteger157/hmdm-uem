package com.hmdm.control;

/**
 * Builds REST URLs for MDM server plugin endpoints.
 * Matches the launcher convention: baseUrl + serverProject + "/rest/...".
 */
public final class MdmApiUrls {

    private MdmApiUrls() {
    }

    public static String buildRestUrl(String serverUrl, String serverProject, String restPath) {
        String base = normalizeBaseUrl(serverUrl);
        String project = normalizeProject(serverProject);
        String path = normalizeRestPath(restPath);
        return base + project + "/rest" + path;
    }

    static String normalizeBaseUrl(String serverUrl) {
        if (serverUrl == null) {
            return "";
        }
        String normalized = serverUrl.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    static String normalizeProject(String serverProject) {
        if (serverProject == null) {
            return "";
        }
        String normalized = serverProject.trim();
        if (normalized.isEmpty()) {
            return "";
        }
        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private static String normalizeRestPath(String restPath) {
        if (restPath == null || restPath.isEmpty()) {
            return "";
        }
        return restPath.startsWith("/") ? restPath : "/" + restPath;
    }
}
