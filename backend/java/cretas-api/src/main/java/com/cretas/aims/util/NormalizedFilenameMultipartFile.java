package com.cretas.aims.util;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.File;
import java.nio.file.Path;

/**
 * MultipartFile decorator that normalizes {@link #getOriginalFilename()} to
 * recover UTF-8 names that Tomcat decoded as ISO-8859-1 (T-R5-2).
 *
 * <p>All other methods delegate straight through; the wrapped stream, bytes,
 * size, content-type and transfer-to behavior are identical to the delegate.
 */
public final class NormalizedFilenameMultipartFile implements MultipartFile {

    private final MultipartFile delegate;

    public NormalizedFilenameMultipartFile(MultipartFile delegate) {
        this.delegate = delegate;
    }

    @Override
    public String getName() {
        return delegate.getName();
    }

    @Override
    public String getOriginalFilename() {
        return MultipartFilenameNormalizer.normalize(delegate.getOriginalFilename());
    }

    @Override
    public String getContentType() {
        return delegate.getContentType();
    }

    @Override
    public boolean isEmpty() {
        return delegate.isEmpty();
    }

    @Override
    public long getSize() {
        return delegate.getSize();
    }

    @Override
    public byte[] getBytes() throws IOException {
        return delegate.getBytes();
    }

    @Override
    public InputStream getInputStream() throws IOException {
        return delegate.getInputStream();
    }

    @Override
    public void transferTo(File dest) throws IOException, IllegalStateException {
        delegate.transferTo(dest);
    }

    @Override
    public void transferTo(Path dest) throws IOException, IllegalStateException {
        delegate.transferTo(dest);
    }
}
