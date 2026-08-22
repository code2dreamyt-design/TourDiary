// Renders a photo + a text overlay box off-screen, then snapshots that
// render into a brand-new image file. This is the actual "burn text onto
// the photo" mechanism — Expo has no direct image-text-drawing API, so the
// standard technique is: render Image + Text in a real (but invisible)
// view, then use react-native-view-shot to capture that view to a file.
//
// This component is a pure rendering primitive. All the *logic* about what
// to draw and when (the GPS stamp pass, then the note pass) lives in
// photoService.js / the screens that call this — this file just knows how
// to composite one box of text onto one image.
import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';

const BOX_POSITION_STYLES = {
  'bottom-left': { left: 12, bottom: 12, alignItems: 'flex-start' },
  'bottom-right': { right: 12, bottom: 12, alignItems: 'flex-end' },
};

const PhotoCompositor = forwardRef((props, ref) => {
  const [job, setJob] = useState(null); // { imageUri, width, height, box, resolve, reject }
  const viewShotRef = React.useRef(null);

  useImperativeHandle(ref, () => ({
    /**
     * Composites `box` (a semi-transparent text box) onto the image at
     * `imageUri`, at its native resolution. Returns a Promise<newUri>.
     * box = { position: 'bottom-left' | 'bottom-right', lines: [{ text, color? }] }
     */
    capture(imageUri, box) {
      return new Promise((resolve, reject) => {
        Image.getSize(
          imageUri,
          (width, height) => {
            setJob({ imageUri, width, height, box, resolve, reject });
          },
          (err) => reject(err)
        );
      });
    },
  }));

  async function handleImageLoad() {
    if (!job || !viewShotRef.current) return;
    try {
      const uri = await viewShotRef.current.capture();
      const { resolve } = job;
      setJob(null);
      resolve(uri);
    } catch (err) {
      const { reject } = job;
      setJob(null);
      reject(err);
    }
  }

  if (!job) return null;

  const { imageUri, width, height, box } = job;
  const positionStyle = BOX_POSITION_STYLES[box.position] || BOX_POSITION_STYLES['bottom-left'];

  return (
    // Positioned far off-screen (not just hidden/opacity 0) — react-native-view-shot
    // can still capture it there, and this guarantees it never flashes on screen.
    <View style={styles.offscreenContainer} pointerEvents="none">
      <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.92 }} style={{ width, height }}>
        <View style={{ width, height }}>
          <Image
            source={{ uri: imageUri }}
            style={{ width, height }}
            onLoad={handleImageLoad}
            resizeMode="cover"
          />
          <View style={[styles.box, positionStyle]}>
            {box.lines.map((line, i) => (
              <Text key={i} style={[styles.boxText, line.color ? { color: line.color } : null]}>
                {line.text}
              </Text>
            ))}
          </View>
        </View>
      </ViewShot>
    </View>
  );
});

export default PhotoCompositor;

const styles = StyleSheet.create({
  offscreenContainer: {
    position: 'absolute',
    top: -100000,
    left: -100000,
  },
  box: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.55)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: '80%',
  },
  boxText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
  },
});
