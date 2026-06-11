import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

export async function POST(req: Request) {
    try {
        const { filename, contentType } = await req.json();

        if (!filename || !contentType) {
            return NextResponse.json(
                { error: 'Filename and contentType are required' },
                { status: 400 }
            );
        }

        const bucketName = process.env.AWS_BUCKET_NAME || 'gog-oms';
        const uniqueFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: uniqueFilename,
            ContentType: contentType,
        });

        // URL expires in 15 minutes
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
        
        // AWS sets up the domain like this by default
        const region = process.env.AWS_REGION || 'ap-south-1';
        const fileUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${uniqueFilename}`;

        return NextResponse.json({
            success: true,
            uploadUrl: signedUrl,
            fileUrl,
            filename: uniqueFilename
        });

    } catch (error: any) {
        console.error("S3 Presigner Error:", error);
        return NextResponse.json(
            { error: 'Failed to generate S3 presigned URL' },
            { status: 500 }
        );
    }
}
