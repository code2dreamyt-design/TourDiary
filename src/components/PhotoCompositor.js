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
    // Off-screen at an extreme negative offset (proven working: a reference
    // build using this exact technique did not exhibit the black-tint bug).
    // The two things that actually matter for Android reliability are:
    //   1. collapsable={false} on the captured view — without it, Android
    //      can "flatten" (optimize away) the view during native layout, so
    //      react-native-view-shot ends up capturing the wrong/empty layer.
    //   2. An explicit opaque backgroundColor — JPG has no alpha channel,
    //      so any transparent pixels in the captured surface (e.g. from
    //      timing/flattening) can otherwise resolve to black.
    <View style={styles.offscreenContainer} pointerEvents="none">
      <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.92 }} style={{ width, height }}>
        <View collapsable={false} style={{ width, height, backgroundColor: '#000' }}>
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
    left: 0,
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
