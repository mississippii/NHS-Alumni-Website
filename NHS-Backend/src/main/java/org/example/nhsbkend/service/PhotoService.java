package org.example.nhsbkend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.concurrent.TimeUnit;

/**
 * Profile photos: stored as square 512px JPEGs in {nhs.upload-dir}/photos and served at /api/photos/{id}.jpg.
 * Re-encoding every upload strips metadata (e.g. GPS location) and anything that isn't image pixels.
 */
@Configuration
public class PhotoService implements WebMvcConfigurer {

    static final int SIZE = 512;
    private static final int MAX_SIDE = 8000; // refuse absurd dimensions before decoding (memory bombs)

    private final Path dir;

    public PhotoService(@Value("${nhs.upload-dir:uploads}") String uploadDir) throws IOException {
        this.dir = Path.of(uploadDir, "photos").toAbsolutePath();
        Files.createDirectories(dir);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/api/photos/**")
                .addResourceLocations(dir.toUri().toString())
                .setCacheControl(org.springframework.http.CacheControl.maxAge(30, TimeUnit.DAYS));
    }

    /**
     * Crops a square around the focus point (fractions of width/height, 0..1), zooms in by {@code zoom} (1 = largest
     * square that fits), resizes to 512px and saves it. Returns the public URL (versioned so browsers reload it).
     */
    public String save(long id, InputStream in, double focusX, double focusY, double zoom) throws IOException {
        return save(id, read(in), focusX, focusY, zoom);
    }

    /** Same, for an image already checked with {@link #read}. */
    public String save(long id, BufferedImage src, double focusX, double focusY, double zoom) throws IOException {
        int side = (int) Math.round(Math.min(src.getWidth(), src.getHeight()) / Math.clamp(zoom, 1, 4));
        int x = clampOffset(focusX * src.getWidth() - side / 2.0, src.getWidth() - side);
        int y = clampOffset(focusY * src.getHeight() - side / 2.0, src.getHeight() - side);

        BufferedImage out = new BufferedImage(SIZE, SIZE, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(Color.WHITE); // transparent PNGs get a white background
        g.fillRect(0, 0, SIZE, SIZE);
        g.drawImage(src, 0, 0, SIZE, SIZE, x, y, x + side, y + side, null);
        g.dispose();

        Path tmp = dir.resolve(id + ".jpg.tmp"), target = dir.resolve(id + ".jpg");
        writeJpeg(out, tmp);
        Files.move(tmp, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING, java.nio.file.StandardCopyOption.ATOMIC_MOVE);
        return "/api/photos/" + id + ".jpg?v=" + Instant.now().getEpochSecond();
    }

    static final int WIDE = 1200;

    /** A story picture: keeps its shape, shrunk to at most 1200px wide. Saved as story-{id}.jpg. */
    public String saveStory(long id, InputStream in) throws IOException {
        BufferedImage src = read(in);
        double k = Math.min(1, (double) WIDE / src.getWidth());
        int w = (int) Math.round(src.getWidth() * k), h = (int) Math.round(src.getHeight() * k);
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, w, h);
        g.drawImage(src, 0, 0, w, h, null);
        g.dispose();
        Path tmp = dir.resolve("story-" + id + ".jpg.tmp"), target = dir.resolve("story-" + id + ".jpg");
        writeJpeg(out, tmp);
        Files.move(tmp, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING, java.nio.file.StandardCopyOption.ATOMIC_MOVE);
        return "/api/photos/story-" + id + ".jpg?v=" + Instant.now().getEpochSecond();
    }

    public void deleteStory(long id) throws IOException {
        Files.deleteIfExists(dir.resolve("story-" + id + ".jpg"));
    }

    private static int clampOffset(double v, int max) {
        return (int) Math.round(Math.clamp(v, 0, Math.max(0, max)));
    }

    public void delete(long id) throws IOException {
        Files.deleteIfExists(dir.resolve(id + ".jpg"));
    }

    /** Decodes and checks an upload. Throws IllegalArgumentException (with a message for the user) if it isn't a usable photo. */
    public static BufferedImage read(InputStream in) throws IOException {
        try (ImageInputStream iis = ImageIO.createImageInputStream(in)) {
            var readers = iis == null ? null : ImageIO.getImageReaders(iis);
            if (readers == null || !readers.hasNext()) throw new IllegalArgumentException("That file isn't a JPEG or PNG image.");
            ImageReader r = readers.next();
            try {
                r.setInput(iis, true, true);
                if (r.getWidth(0) > MAX_SIDE || r.getHeight(0) > MAX_SIDE)
                    throw new IllegalArgumentException("Image is too large (max " + MAX_SIDE + " px per side).");
                if (r.getWidth(0) < 64 || r.getHeight(0) < 64) throw new IllegalArgumentException("Image is too small (min 64 px).");
                return r.read(0);
            } finally {
                r.dispose();
            }
        }
    }

    private static void writeJpeg(BufferedImage img, Path file) throws IOException {
        var w = ImageIO.getImageWritersByFormatName("jpeg").next();
        try (ImageOutputStream out = ImageIO.createImageOutputStream(file.toFile())) {
            w.setOutput(out);
            ImageWriteParam p = w.getDefaultWriteParam();
            p.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            p.setCompressionQuality(0.86f);
            w.write(null, new IIOImage(img, null, null), p);
        } finally {
            w.dispose();
        }
    }
}
