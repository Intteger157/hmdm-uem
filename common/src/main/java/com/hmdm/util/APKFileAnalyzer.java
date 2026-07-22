/*
 *
 * Headwind MDM: Open Source Android MDM Software
 * https://h-mdm.com
 *
 * Copyright (C) 2019 Headwind Solutions LLC (http://h-sms.com)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package com.hmdm.util;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.hmdm.persistence.ApplicationDAO;
import com.hmdm.persistence.domain.Application;
import com.hmdm.rest.json.APKFileDetails;
import net.dongliu.apk.parser.ApkFile;
import net.dongliu.apk.parser.bean.ApkMeta;
import org.apache.commons.io.IOUtils;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Named;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * <p>An analyzer for uploaded APK-files.</p>
 *
 * @author isv
 */
@Singleton
public class APKFileAnalyzer {

    /**
     * <p>A logger for the encountered events.</p>
     */
    private static final Logger log = LoggerFactory.getLogger(ApplicationDAO.class);

    /**
     * <p>A command line string to call the <code>aapt</code> command.</p>
     */
    private final String aaptCommand;

    /**
     * Pattern matcher to parse the first line of aapt
     */
    Pattern pattern = Pattern.compile("(\\w+)=\\'([^\\']*)\\'");

    /**
     * <p>Constructs new <code>APKFileAnalyzer</code> instance. This implementation does nothing.</p>
     */
    @Inject
    public APKFileAnalyzer(@Named("aapt.command") String aaptCommand) {
        this.aaptCommand = aaptCommand;
    }

    /**
     * <p>Analyzes the specified file (APK or XAPK).</p>
     *
     * @param filePath an absolute path to an file to be analyzed.
     * @throws APKFileAnalyzerException if an unexpected error occurs or external <code>aapt</code> command reported an
     *         error.
     */
    public APKFileDetails analyzeFile(String filePath) {
        String realFileName = filePath.endsWith(".temp") ? FileUtil.getNameFromTmpPath(filePath) : filePath;
        if (FileUtil.isXapk(realFileName)) {
            return analyzeXapkFile(filePath);
        } else if (FileUtil.isApkOrXapk(realFileName)) {
            return analyzeApkFile(filePath);
        }
        throw new APKFileAnalyzerException("Unsupported application file type: " + realFileName);
    }

    /**
     * <p>Analyzes the specified APK file using the aapt utility.</p>
     *
     * @param filePath an absolute path to an APK-file to be analyzed.
     * @throws APKFileAnalyzerException if an unexpected error occurs or external <code>aapt</code> command reported an
     *         error.
     */
    private APKFileDetails analyzeApkFile(String filePath) {
        try (ApkFile apkFile = new ApkFile(new File(filePath))) {
            ApkMeta apkMeta = apkFile.getApkMeta();
            APKFileDetails result = new APKFileDetails();
            result.setPkg(apkMeta.getPackageName());
            String label = apkMeta.getLabel();
            result.setName(label != null ? label : "");
            result.setVersion(apkMeta.getVersionName());
            Long versionCode = apkMeta.getVersionCode();
            result.setVersionCode(versionCode != null ? versionCode.intValue() : 0);
            result.setArch(getArchByApkLibs(filePath));
            return result;
        } catch (IOException e) {
            log.error("Failed to analyze APK-file: {}", filePath, e);
            throw new APKFileAnalyzerException("Failed to analyze APK-file", e);
        }
    }

    /**
     * Detect native-code ABIs by scanning lib/<abi>/
     * Returns null for universal APK, or arch label for a single-arch APK
     */
    private String getArchByApkLibs(String filePath) {
        Set<String> abis = new TreeSet<>();
        try (ZipFile zip = new ZipFile(new File(filePath))) {
            zip.stream().forEach(e -> {
                String name = e.getName();
                if (name.startsWith("lib/")) {
                    String[] parts = name.split("/");
                    if (parts.length > 1) {
                        abis.add(parts[1]);
                    }
                }
            });
        } catch (IOException e) {
            log.error("Failed to fetch libraries from APK-file: {}", filePath, e);
            return null;
        }

        String result = null;
        for (String abi : abis) {
            if ("arm64-v8a".equals(abi)) {
                if (Application.ARCH_ARMEABI.equals(result)) {
                    // ARMEABI has already been set elsewhere, so it is a universal file
                    return null;
                }
                result = Application.ARCH_ARM64;
            } else if ("armeabi-v7a".equals(abi)) {
                if (Application.ARCH_ARM64.equals(result)) {
                    // ARM64 has already been set elsewhere, so it is a universal file
                    return null;
                }
                result = Application.ARCH_ARMEABI;
            }
        }

        return result;
    }

    /**
     * <p>Analyzes the specified APK file using the aapt utility.
     * DEPRECATED AND NOT USED ANY MORE</p>
     *
     * @param filePath an absolute path to an APK-file to be analyzed.
     * @throws APKFileAnalyzerException if an unexpected error occurs or external <code>aapt</code> command reported an
     *         error.
     */
    private APKFileDetails analyzeApkFileByAapt(String filePath) {
        try {
            final String[] commands = {this.aaptCommand, "dump", "badging", filePath};
            log.debug("Executing shell-commands: {}", Arrays.toString(commands));
            final Process exec = Runtime.getRuntime().exec(commands);

            final AtomicReference<String> appPkg = new AtomicReference<>();
            final AtomicReference<String> appName = new AtomicReference<>();
            final AtomicReference<String> appVersion = new AtomicReference<>();
            final AtomicReference<Integer> appVersionCode = new AtomicReference<>();
            final AtomicReference<String> appArch = new AtomicReference<>();
            final List<String> errorLines = new ArrayList<>();

            // Process the error stream by collecting all the error lines for further logging
            StreamGobbler errorGobbler = new StreamGobbler(exec.getErrorStream(), "ERROR", errorLines::add);

            // Process the output by analyzing the line starting with "package:"
            StreamGobbler outputGobbler = new StreamGobbler(exec.getInputStream(), "APK-file DUMP", line -> {
                if (line.startsWith("package:")) {
                    parseInfoLine(line, appPkg, appVersion, appVersionCode);
                    if (appPkg.get() == null || appVersion.get() == null) {
                        // AAPT output is wrong!
                        log.warn("Failed to parse aapt output: '" + line + "', trying legacy parser");
                        parseInfoLineLegacy(line, appPkg, appVersion, appVersionCode);
                    }
                } else if (line.startsWith("native-code:") || line.startsWith("alt-native-code:")) {
                    // This is an optional line, so do not care for errors
                    parseNativeCodeLine(line, appArch);
                } else if (line.startsWith("application-label:")) {
                    parseAppName(line, appName);
                }
            });

            // Get ready to consume input and error streams from the process
            errorGobbler.start();
            outputGobbler.start();

            final int exitCode = exec.waitFor();

            outputGobbler.join();
            errorGobbler.join();

            if (exitCode == 0) {
                log.debug("Parsed application name and version from APK-file {}: {} {} {}",
                        filePath, appPkg, appVersion, appVersionCode);
                APKFileDetails result = new APKFileDetails();

                result.setPkg(appPkg.get());
                result.setVersion(appVersion.get());
                Integer versionCode = appVersionCode.get();
                result.setVersionCode(versionCode != null ? versionCode : 0);
                result.setArch(appArch.get());
                result.setName(appName.get());

                return result;
            } else {
                log.error("Could not analyze the .apk-file {}. The system process returned: {}. " +
                        "The error message follows:", filePath, exitCode);
                errorLines.forEach(log::error);
                throw new APKFileAnalyzerException("Could not analyze the .apk-file");
            }
        } catch (IOException | InterruptedException e) {
            log.error("Unexpected error while analyzing APK-file: {}", filePath, e);
            throw new APKFileAnalyzerException("Unexpected error while analyzing APK-file", e);
        }
    }

    // This function deals with an issue when the version name contains a space or even an apostrophe
    // It presumes the following format of the line:
    // package: name='xxxxx' versionCode='xxxxx' versionName='xxxxx' compileSdkVersion='xxx' compileSdkVersionCodename='xxx'
    private void parseInfoLine(final String line,
                               final AtomicReference<String> appPkg,
                               final AtomicReference<String> appVersion,
                               final AtomicReference<Integer> appVersionCode) {

        Matcher matcher = pattern.matcher(line);
        while (matcher.find()) {
            if (matcher.group(1).equals("name")) {
                appPkg.set(matcher.group(2));
            } else if (matcher.group(1).equals("versionName")) {
                appVersion.set(matcher.group(2));
            } else if (matcher.group(1).equals("versionCode")) {
                try {
                    appVersionCode.set(Integer.parseInt(matcher.group(2)));
                } catch (NumberFormatException e) {
                }
            }
        }
    }

    private void parseInfoLineLegacy(final String line,
                                     final AtomicReference<String> appPkg,
                                     final AtomicReference<String> appVersion,
                                     final AtomicReference<Integer> appVersionCode) {
        Scanner scanner = new Scanner(line).useDelimiter(" ");
        while (scanner.hasNext()) {
            final String token = scanner.next();
            if (token.startsWith("name=")) {
                String appPkgLocal = token.substring("name=".length());
                if (appPkgLocal.startsWith("'") && appPkgLocal.endsWith("'")) {
                    appPkgLocal = appPkgLocal.substring(1, appPkgLocal.length() - 1);
                }
                appPkg.set(appPkgLocal);
            } else if (token.startsWith("versionCode=")) {
                String appVersionCodeLocal = token.substring("versionCode=".length());
                if (appVersionCodeLocal.startsWith("'") && appVersionCodeLocal.endsWith("'")) {
                    appVersionCodeLocal = appVersionCodeLocal.substring(1, appVersionCodeLocal.length() - 1);
                }
                try {
                    appVersionCode.set(Integer.parseInt(appVersionCodeLocal));
                } catch (NumberFormatException e) {
                }
            } else if (token.startsWith("versionName=")) {
                String appVersionLocal = token.substring("versionName=".length());
                if (appVersionLocal.startsWith("'") && appVersionLocal.endsWith("'")) {
                    appVersionLocal = appVersionLocal.substring(1, appVersionLocal.length() - 1);
                }
                appVersion.set(appVersionLocal);
            }
        }
    }

    // Parse a line containing the native code CPU architecture
    // It presumes the following format of the line:
    // native-code: 'xxxxx'
    private void parseNativeCodeLine(final String line, final AtomicReference<String> appArch) {
        if (line.indexOf("armeabi-v7a") != -1) {
            if (Application.ARCH_ARM64.equals(appArch.get())) {
                // ARM64 has already been set elsewhere, so it is a universal file
                // This is the case when the AAPT output has the form:
                // native-code: 'armeabi-v7a'
                // alt-native-code: 'arm64-v8a'
                appArch.set(null);
                return;
            }
            appArch.set(Application.ARCH_ARMEABI);
            if (line.indexOf("arm64-v8a") != -1) {
                // Native code for both architectures present, so it is a universal file
                appArch.set(null);
            }
        } else if (line.indexOf("arm64-v8a") != -1) {
            if (Application.ARCH_ARMEABI.equals(appArch.get())) {
                // ARMEABI has already been set elsewhere, so it is a universal file
                appArch.set(null);
                return;
            }
            appArch.set(Application.ARCH_ARM64);
        }
    }

    private void parseAppName(final String line, final AtomicReference<String> appName) {
        String[] parts = line.split(":", 2);
        if (parts.length < 2 || parts[1].length() <= 2) {
            return;
        }
        String trimmedName = parts[1].trim();
        trimmedName = trimmedName.substring(1, trimmedName.length() - 1);
        appName.set(trimmedName);
    }

    /**
     * <p>A consumer for the stream contents. Outputs the line read from the stream and passes it to provided line
     * consumer.</p>
     */
    private class StreamGobbler extends Thread {
        private final InputStream is;
        private final String type;
        private final Consumer<String> lineConsumer;

        private StreamGobbler(InputStream is, String type, Consumer<String> lineConsumer) {
            this.is = is;
            this.type = type;
            this.lineConsumer = lineConsumer;
        }

        public void run() {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(is))) {
                String line;
                while ((line = br.readLine()) != null) {
                    log.debug(type + "> " + line);
                    this.lineConsumer.accept(line);
                }
            } catch (Exception e) {
                log.error("An error in {} stream handler for external process {}", this.type, aaptCommand, e);
            }
        }
    }

    /**
     * <p>Analyzes the specified XAPK file.</p>
     *
     * @param filePath an absolute path to an XAPK-file to be analyzed.
     * @throws APKFileAnalyzerException if an unexpected error occurs
     */
    private APKFileDetails analyzeXapkFile(String filePath) {
        try (ZipFile zipFile = new ZipFile(filePath)) {
            String manifestContent = readManifestFromZip(zipFile, "manifest.json");
            if (manifestContent == null) {
                manifestContent = readManifestFromZip(zipFile, "info.json");
            }
            if (manifestContent != null) {
                try {
                    return analyzeXapkManifest(manifestContent);
                } catch (Exception e) {
                    log.warn("Failed to parse XAPK metadata from manifest, trying embedded APK: {}", filePath, e);
                }
            } else {
                log.warn("No manifest.json or info.json in XAPK, trying embedded APK: {}", filePath);
            }
            return analyzeEmbeddedApkInZip(zipFile);
        } catch (APKFileAnalyzerException e) {
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error while analyzing XAPK-file: {}", filePath, e);
            throw new APKFileAnalyzerException("Unexpected error while analyzing XAPK-file", e);
        }
    }

    private String readManifestFromZip(ZipFile zipFile, String manifestName) throws IOException {
        ZipEntry entry = findZipEntry(zipFile, manifestName);
        if (entry == null) {
            return null;
        }
        try (InputStream stream = zipFile.getInputStream(entry)) {
            return IOUtils.toString(stream, StandardCharsets.UTF_8);
        }
    }

    private ZipEntry findZipEntry(ZipFile zipFile, String entryName) {
        String suffix = "/" + entryName;
        ZipEntry found = null;
        for (ZipEntry entry : Collections.list(zipFile.entries())) {
            String name = entry.getName();
            if (name.equalsIgnoreCase(entryName) || name.endsWith(suffix)) {
                if (found == null || name.length() < found.getName().length()) {
                    found = entry;
                }
            }
        }
        return found;
    }

    private APKFileDetails analyzeEmbeddedApkInZip(ZipFile zipFile) throws IOException {
        ZipEntry apkEntry = findEmbeddedApkEntry(zipFile);
        if (apkEntry == null) {
            throw new APKFileAnalyzerException("Missing manifest and APK in XAPK-file", new Exception());
        }
        File tempApk = File.createTempFile("xapk-apk-", ".apk");
        try {
            try (InputStream in = zipFile.getInputStream(apkEntry);
                 FileOutputStream out = new FileOutputStream(tempApk)) {
                IOUtils.copy(in, out);
            }
            return analyzeApkFile(tempApk.getAbsolutePath());
        } finally {
            tempApk.delete();
        }
    }

    private ZipEntry findEmbeddedApkEntry(ZipFile zipFile) {
        ZipEntry largestApk = null;
        long largestSize = -1;
        for (ZipEntry entry : Collections.list(zipFile.entries())) {
            if (entry.isDirectory()) {
                continue;
            }
            String name = entry.getName();
            if (!name.toLowerCase().endsWith(".apk")) {
                continue;
            }
            String fileName = name.substring(name.lastIndexOf('/') + 1);
            if (fileName.equalsIgnoreCase("base.apk")) {
                return entry;
            }
            long size = entry.getSize() >= 0 ? entry.getSize() : entry.getCompressedSize();
            if (size > largestSize) {
                largestSize = size;
                largestApk = entry;
            }
        }
        return largestApk;
    }

    private APKFileDetails analyzeXapkManifest(String manifest) {
        JSONObject jsonObject = new JSONObject(manifest.trim());
        APKFileDetails fileDetails = new APKFileDetails();

        String pkg = optManifestString(jsonObject, "package_name", "pname", "packageName");
        if (pkg == null) {
            throw new APKFileAnalyzerException("Missing package name in XAPK manifest");
        }
        fileDetails.setPkg(pkg);

        String version = optManifestString(jsonObject, "version_name", "versionName", "release_version");
        fileDetails.setVersion(version != null ? version : "");

        fileDetails.setVersionCode(parseManifestVersionCode(jsonObject));

        String name = optManifestString(jsonObject, "name", "label");
        if (name != null) {
            fileDetails.setName(name);
        }

        // XAPK manifest doesn't contain data about the native code
        // So we try to guess it by searching the keywords
        boolean hasArm64 = manifest.contains("arm64");
        boolean hasArmeabi = manifest.contains("armeabi");
        if (hasArm64 && !hasArmeabi) {
            fileDetails.setArch(Application.ARCH_ARM64);
        } else if (hasArmeabi && !hasArm64) {
            fileDetails.setArch(Application.ARCH_ARMEABI);
        }

        return fileDetails;
    }

    private String optManifestString(JSONObject jsonObject, String... keys) {
        for (String key : keys) {
            if (!jsonObject.has(key)) {
                continue;
            }
            String value = jsonObject.optString(key, "").trim();
            if (!value.isEmpty()) {
                return value;
            }
        }
        return null;
    }

    private int parseManifestVersionCode(JSONObject jsonObject) {
        for (String key : new String[]{"version_code", "versioncode", "versionCode"}) {
            if (!jsonObject.has(key)) {
                continue;
            }
            Object value = jsonObject.get(key);
            if (value instanceof Number) {
                return ((Number) value).intValue();
            }
            if (value instanceof String) {
                try {
                    return Integer.parseInt(((String) value).trim());
                } catch (NumberFormatException e) {
                    // try next key
                }
            }
        }
        return 0;
    }
}
