# Student Management App

A React Native mobile application for managing student records with Firebase Authentication and Cloud Firestore.

## Features

- User Registration and Login
- Firebase Authentication
- Add New Students
- View Student Records
- Update Student Information
- Delete Student Records
- Search Students
- User-specific Data Storage
- Secure Firestore Access Rules

## Technologies Used

- React Native
- TypeScript
- JavaScript
- Firebase Authentication
- Cloud Firestore
- Android

## Security

Each authenticated user can access only their own student records. Firestore Security Rules enforce access using the authenticated user's UID.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/shahfaisal3863/student-management-app.git
   ```

2. Open the project folder:

   ```bash
   cd student-management-app
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Configure Firebase:

   - Create a Firebase project.
   - Register an Android app using the package name `com.studentmanagementapp`.
   - Download `google-services.json`.
   - Place it inside `android/app/`.
   - Enable Email/Password authentication.
   - Set up Cloud Firestore and publish the required security rules.

5. Run the application:

   ```bash
   npm run android
   ```

## Repository

[GitHub - Student Management App](https://github.com/shahfaisal3863/student-management-app)

## Developer

**Shah Faisal**

GitHub: [@shahfaisal3863](https://github.com/shahfaisal3863)