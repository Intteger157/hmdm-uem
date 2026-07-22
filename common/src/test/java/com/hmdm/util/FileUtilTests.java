package com.hmdm.util;

import org.junit.Assert;
import org.junit.Test;

public class FileUtilTests {

    @Test
    public void isApkOrXapkDetectsApkAndXapkExtensions() {
        Assert.assertTrue(FileUtil.isApkOrXapk("app.apk"));
        Assert.assertTrue(FileUtil.isApkOrXapk("app.xapk"));
        Assert.assertTrue(FileUtil.isApkOrXapk("C:\\downloads\\whatsapp-business.xapk"));
        Assert.assertFalse(FileUtil.isApkOrXapk("app.apkm"));
        Assert.assertFalse(FileUtil.isApkOrXapk("readme.txt"));
    }

    @Test
    public void endsWithApkSuffixDoesNotMatchXapk() {
        Assert.assertFalse("whatsapp.xapk".endsWith(".apk"));
        Assert.assertTrue("whatsapp.xapk".endsWith(".xapk"));
    }
}
