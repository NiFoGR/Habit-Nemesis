// Every bitmap a widget shows: the owed ring, and one glyph per grid cell.
// RemoteViews carry these across a binder, so they are kept small.
package com.habitnemesis.widgets;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;

final class Draw {

    private Draw() {
    }

    /** Solid disc when the day is cleared, otherwise an arc on a track. */
    static Bitmap ring(int size, int done, int total, int track, int fill) {
        Bitmap bitmap = blank(size);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        if (total > 0 && done >= total) {
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(fill);
            canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
            return bitmap;
        }

        float stroke = size * 0.13f;
        RectF box = new RectF(stroke / 2f, stroke / 2f, size - stroke / 2f, size - stroke / 2f);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(stroke);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setColor(track);
        canvas.drawOval(box, paint);

        if (total <= 0 || done <= 0) return bitmap;
        paint.setColor(fill);
        // Twelve o'clock, clockwise.
        canvas.drawArc(box, -90f, 360f * done / total, false, paint);
        return bitmap;
    }

    static Bitmap tick(int size, int colour) {
        Bitmap bitmap = blank(size);
        Path path = new Path();
        path.moveTo(size * 0.24f, size * 0.52f);
        path.lineTo(size * 0.43f, size * 0.72f);
        path.lineTo(size * 0.78f, size * 0.29f);
        new Canvas(bitmap).drawPath(path, stroke(size, colour));
        return bitmap;
    }

    static Bitmap cross(int size, int colour) {
        Bitmap bitmap = blank(size);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = stroke(size, colour);
        canvas.drawLine(size * 0.30f, size * 0.30f, size * 0.70f, size * 0.70f, paint);
        canvas.drawLine(size * 0.70f, size * 0.30f, size * 0.30f, size * 0.70f, paint);
        return bitmap;
    }

    static Bitmap skip(int size, int colour) {
        Bitmap bitmap = blank(size);
        new Canvas(bitmap).drawLine(size * 0.28f, size * 0.5f, size * 0.72f, size * 0.5f, stroke(size, colour));
        return bitmap;
    }

    static Bitmap dot(int size, int colour) {
        Bitmap bitmap = blank(size);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(colour);
        new Canvas(bitmap).drawCircle(size / 2f, size / 2f, Math.max(1.5f, size * 0.09f), paint);
        return bitmap;
    }

    /** A logged number, shrunk to fit the cell. */
    static Bitmap label(int size, String text, int colour) {
        Bitmap bitmap = blank(size);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(colour);
        paint.setTypeface(Typeface.DEFAULT_BOLD);
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTextSize(size * 0.54f);
        float room = size * 0.94f;
        float width = paint.measureText(text);
        if (width > room && width > 0) paint.setTextSize(paint.getTextSize() * room / width);
        Paint.FontMetrics metrics = paint.getFontMetrics();
        float baseline = size / 2f - (metrics.ascent + metrics.descent) / 2f;
        new Canvas(bitmap).drawText(text, size / 2f, baseline, paint);
        return bitmap;
    }

    private static Bitmap blank(int size) {
        return Bitmap.createBitmap(Math.max(1, size), Math.max(1, size), Bitmap.Config.ARGB_8888);
    }

    private static Paint stroke(int size, int colour) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(Math.max(2f, size * 0.11f));
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        paint.setColor(colour);
        return paint;
    }
}
