// Mock for database module
export const insertDownload = jest.fn().mockResolvedValue(undefined);
export const getDownload = jest.fn().mockResolvedValue(null);
export const getAllDownloads = jest.fn().mockResolvedValue([]);
export const getDownloadsByReciter = jest.fn().mockResolvedValue([]);
export const deleteDownload = jest.fn().mockResolvedValue(undefined);
export const isDownloaded = jest.fn().mockResolvedValue(false);