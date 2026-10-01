import { Alert } from 'react-native';
import { resetExportFolder, shareDocxFile } from '../services/deviceSave';

// Shared result / error dialogs for every Word export (diary + TD), so a
// download behaves and reads the same wherever it is started.

/** Call after a successful export. */
export function presentExportResult(result) {
  if (!result || result.kind !== 'saved') return; // iOS share sheet needs no extra dialog
  Alert.alert('Saved to your phone', `${result.fileName} was saved in the folder you chose.`, [
    { text: 'OK', style: 'cancel' },
    {
      text: 'Share',
      onPress: () => {
        shareDocxFile(result.fileName, result.base64).catch(() => {
          Alert.alert('Share Failed', 'Unable to open the share dialog.');
        });
      },
    },
    {
      text: 'Change folder',
      onPress: async () => {
        await resetExportFolder();
        Alert.alert('Folder reset', 'You will be asked to choose a save folder on your next download.');
      },
    },
  ]);
}

/**
 * Call from a catch block. `navigation` is used for the Subscribe button.
 * Returns nothing; shows the right dialog for each error code.
 */
export function presentExportError(err, navigation) {
  const code = err && err.code;
  if (code === 'SAVE_CANCELLED') {
    Alert.alert('Not saved', 'No folder was chosen, so the file was not saved. Tap download again and choose a folder.');
  } else if (code === 'WRITE_LOCKED') {
    const subscriptionIssue = err.reason === 'EXPIRED' || err.reason === 'NO_ENTITLEMENT';
    if (!subscriptionIssue) {
      Alert.alert('Unavailable', err.message);
    } else {
      Alert.alert('Subscription Required', err.message, [
        { text: 'Not Now', style: 'cancel' },
        { text: 'Subscribe', onPress: () => navigation.navigate('Subscription') },
      ]);
    }
  } else if (code === 'SHARING_UNAVAILABLE') {
    Alert.alert('Not available', 'Saving or sharing files is not available on this device.');
  } else if (code === 'NOTHING_TO_EXPORT') {
    Alert.alert('Nothing to export', err.message);
  } else {
    Alert.alert('Export Failed', (err && err.message) || 'Unable to generate the Word document. Please try again.');
  }
}
