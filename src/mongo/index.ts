// MongoDB 모듈의 주요 기능들을 외부로 export
export * from './config';
export * from './client';
export { default as uploadDataToMongoDB } from './uploader';

// 편의 함수들
export async function quickUpload(): Promise<void> {
  const module = await import('./uploader');
  const upload = module.default ?? (module as any).uploadDataToMongoDB;
  await upload();
}
