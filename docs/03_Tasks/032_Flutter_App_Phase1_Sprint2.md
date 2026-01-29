# Phase 1 Sprint 2: Authentication & Routing

## 1. Goal
Implement a secure authentication flow using Firebase Auth, ensuring users can sign in and maintain their session. Establish the app's routing architecture with protection mechanisms to redirect unauthenticated users.

## 2. Tasks

### 2.1 Domain Layer (Authentication)
- [x] Create `domain/repositories/auth_repository.dart`
    - Define `signInWithEmailAndPassword`
    - Define `signOut`
    - Define `authStateChanges` stream
    - Define `getIdToken`

### 2.2 Data Layer (Authentication)
- [x] Implement `data/repositories/auth_repository_impl.dart`
    - Implement `AuthRepository` interface
    - Integrate `FirebaseAuth`
    - Call `ApiClient.signIn` to sync with backend after Firebase auth succeeds

### 2.3 State Management (Riverpod)
- [x] Create `presentation/providers/auth_provider.dart`
    - `authRepositoryProvider`
    - `authStateProvider` (StreamProvider)
    - `isAuthenticatedProvider`

### 2.4 UI Implementation
- [x] Create `presentation/screens/splash/splash_screen.dart`
    - Simple loading screen while checking auth state
- [x] Create `presentation/screens/auth/signin_screen.dart`
    - Email & Password input fields
    - Sign In button with loading state
    - Error handling display

### 2.5 Routing & Navigation
- [x] Configure `GoRouter` in `presentation/routes/app_router.dart`
    - Define routes: `/splash`, `/auth/signin`, `/dashboard` (placeholder)
    - Implement redirect logic based on `isAuthenticatedProvider`
- [x] Update `main.dart` to use `AppRouter`

### 2.6 Integration & Testing
- [x] Verify Sign In flow
- [x] Verify Auto-login (Splash -> Dashboard)
- [x] Verify Sign Out (if applicable in this sprint, or manually via code to test)
- [x] Run `flutter analyze` to ensure code quality

## 3. Definition of Done
- User can sign in with valid credentials.
- App redirects to Sign In screen if not authenticated.
- App redirects to Dashboard if authenticated.
- Code compiles without errors.
