# Review Report: image-capture

## Verdict
PASS WITH MINOR ISSUES

## Issues Found

### 🔴 Blocking (must fix before merge)

None.

### 🟡 Important (should fix)

- [ ] `app/ios/Runner/Info.plist:5-8` — **Unrelated `UIDeviceFamily` change crept in.** The diff adds `<key>UIDeviceFamily</key><array><integer>1</integer></array>`, which restricts the app to iPhone only (removes iPad). This is NOT part of the image-capture feature and appears to be an unintended side effect. Should be reverted to avoid accidentally dropping iPad support.

### 🟢 Minor (optional)

- [ ] `app/lib/presentation/screens/capture/capture_screen.dart:1139-1156` — **New image UI code uses hardcoded colors while same diff migrates existing code to theme colors.** The image picker button uses `Colors.white.withOpacity(0.08)`, `Colors.white.withOpacity(0.15)`, `Colors.white.withOpacity(0.6)`, and the remove button uses `Colors.black.withOpacity(0.6)`. Meanwhile, the same diff converts dozens of existing `Colors.white.withOpacity(...)` calls to `Theme.of(context).colorScheme.*` and `.withValues(alpha: ...)`. New code should follow the same pattern for consistency.

- [ ] `app/lib/domain/repositories/brain_dump_repository.dart:11` — **`String text` named parameter lacks default value in interface.** While Dart allows this in abstract methods, adding `= ''` (matching the impl) would make the contract explicit and self-documenting for callers.

## AC Verification
- [x] AC1: Verified — `_showImageSourcePicker()` at `capture_screen.dart:78` shows bottom sheet with camera/gallery options
- [x] AC2: Verified — Image preview at `capture_screen.dart:1120-1143` with 120px height; hint text changes to "補充說明（可選）..." at `capture_screen.dart:1176`
- [x] AC3: Verified — `brainDumpWithImage()` at `api_client.dart:240-265` sends multipart/form-data with `image`, `text`, `input_type` fields
- [x] AC4: Verified — Same `CircularProgressIndicator` at `capture_screen.dart:1214-1222` used for both text and image submission
- [x] AC5: Verified — Shared `_mapResponse()` at `brain_dump_repository_impl.dart:58-101` handles both `createNewTasks` and `appendSubItem`
- [x] AC6: Verified — X button at `capture_screen.dart:1130-1141` calls `_removeImage()` to clear `_selectedImage`
- [x] AC7: Verified — 10MB limit at `capture_screen.dart:37`, extension whitelist at `capture_screen.dart:38`, SnackBar errors at `capture_screen.dart:67-75`
- [x] AC8: Verified — `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` at `Info.plist:52-55`
- [x] AC9: Verified — `input_type` field at `api_client.dart:246` distinguishes `image` vs `image_with_text`; `_submit()` at `capture_screen.dart:149-151` allows empty text with image

## Must NOT Change Files Check
- [x] `api/src/app/api/brain-dump/route.ts` — Not in diff (note: this path doesn't exist in current project structure, likely moved)
- [x] `api/src/lib/image-understanding.ts` — Not in diff
- [x] `api/src/application/use-cases/brain-dump/*.ts` — Changed in working tree BUT unrelated to image-capture feature (confirmed by review brief listing only `app/` files)

## Summary

Clean, well-structured implementation that follows the existing Clean Architecture patterns. The `_mapResponse()` extraction is a good refactoring decision that reduces duplication. All 9 ACs are satisfied. The only actionable issue is an unrelated `UIDeviceFamily` change in `Info.plist` that should be reverted to avoid accidentally restricting to iPhone-only. The minor color consistency issues are cosmetic and can be addressed in a future pass.
