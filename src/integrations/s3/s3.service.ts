import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import env from "../../core/config/env.js";

const s3Config = {
    region: env.S3_REGION || "auto",
    endpoint: env.S3_ENDPOINT,
    credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: env.S3_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: true, // Required for Cloudflare R2 path-style addressing
};

const s3Client = new S3Client(s3Config);

interface PresignedUrlResponse {
    uploadUrl: string;
    fileUrl: string;
}

class S3Service {
    /**
     * Generates a presigned URL for uploading a file to R2
     */
    static async getPresignedUrl(key: string, contentType: string): Promise<PresignedUrlResponse> {
        const AVATAR_BUCKET = env.S3_AVATAR_BUCKET || "profile";
        
        const command = new PutObjectCommand({
            Bucket: AVATAR_BUCKET,
            Key: key,
            ContentType: contentType,
            ChecksumAlgorithm: undefined 
        });

        // URL expires in 15 minutes (900 seconds)
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
        
        // Public URL base
        const publicBase = env.S3_PUBLIC_URL || `https://${AVATAR_BUCKET}.${env.S3_ENDPOINT?.split('//')[1]}`;
        const fileUrl = `${publicBase}/${key}`;

        return { uploadUrl, fileUrl };
    }
}

export default S3Service;
