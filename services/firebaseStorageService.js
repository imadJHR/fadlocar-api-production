// api/services/firebaseStorageService.js
const { bucket } = require('../config/firebase');
const path = require('path');

class FirebaseStorageService {
  // Upload file to Firebase Storage
  static async uploadFile(file, folder = 'uploads') {
    return new Promise((resolve, reject) => {
      try {
        // Generate unique filename
        const fileExtension = path.extname(file.originalname);
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileName = `${folder}/${timestamp}-${randomString}${fileExtension}`;

        // Create file reference
        const fileRef = bucket.file(fileName);

        // Create write stream
        const blobStream = fileRef.createWriteStream({
          metadata: {
            contentType: file.mimetype,
            metadata: {
              originalName: file.originalname,
              uploadedAt: new Date().toISOString()
            }
          },
          public: true // Make files publicly accessible
        });

        blobStream.on('error', (error) => {
          console.error('❌ Firebase upload error:', error);
          reject(new Error('Unable to upload file to storage'));
        });

        blobStream.on('finish', async () => {
          try {
            // Make the file public
            await fileRef.makePublic();

            // Get public URL
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

            console.log(`✅ File uploaded to Firebase: ${publicUrl}`);

            resolve({
              url: publicUrl,
              filename: fileName,
              originalName: file.originalname,
              size: file.size,
              mimetype: file.mimetype,
              uploadedAt: new Date().toISOString()
            });
          } catch (error) {
            console.error('❌ Error making file public:', error);
            reject(new Error('Unable to make file public'));
          }
        });

        // Write file buffer to stream
        blobStream.end(file.buffer);

      } catch (error) {
        console.error('❌ Firebase upload service error:', error);
        reject(error);
      }
    });
  }

  // Upload multiple files
  static async uploadMultipleFiles(files, folder = 'uploads') {
    try {
      const uploadPromises = files.map(file => this.uploadFile(file, folder));
      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      console.error('❌ Multiple files upload error:', error);
      throw error;
    }
  }

  // Delete file from Firebase Storage
  static async deleteFile(fileUrl) {
    try {
      // Extract filename from URL
      const fileName = fileUrl.split('/').pop();
      const filePath = `uploads/${fileName}`;

      const fileRef = bucket.file(filePath);
      
      // Check if file exists
      const [exists] = await fileRef.exists();
      
      if (exists) {
        await fileRef.delete();
        console.log(`✅ File deleted from Firebase: ${filePath}`);
        return true;
      } else {
        console.log(`⚠️ File not found in Firebase: ${filePath}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Firebase delete error:', error);
      throw new Error('Unable to delete file from storage');
    }
  }

  // Delete multiple files
  static async deleteMultipleFiles(fileUrls) {
    try {
      const deletePromises = fileUrls.map(url => this.deleteFile(url));
      const results = await Promise.allSettled(deletePromises);
      
      const successfulDeletes = results.filter(result => result.status === 'fulfilled' && result.value).length;
      console.log(`✅ Successfully deleted ${successfulDeletes} files from Firebase`);
      
      return successfulDeletes;
    } catch (error) {
      console.error('❌ Multiple files delete error:', error);
      throw error;
    }
  }

  // Extract filename from URL for deletion
  static extractFilenameFromUrl(url) {
    try {
      const urlParts = url.split('/');
      return urlParts[urlParts.length - 1];
    } catch (error) {
      console.error('❌ Error extracting filename from URL:', error);
      return null;
    }
  }
}

module.exports = FirebaseStorageService;