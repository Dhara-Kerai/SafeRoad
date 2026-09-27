import { useState } from 'react';
import { uploadImage, getServerUrl } from '../../services/reportService';

interface Props {
  image: string | null;
  imagePreview: string | null;
  onImage: (value: string | null, preview: string | null) => void;
}

export const UploadCard = ({ image, imagePreview, onImage }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      const imageUrl = await uploadImage(file);
      onImage(imageUrl, URL.createObjectURL(file));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (uploading) {
    return (
      <div className="report-card upload-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '12px'
        }} />
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>Uploading image...</p>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  return (
    <div className="report-card upload-card">
      {image ? (
        <>
          <img src={imagePreview || getServerUrl(image)} alt="Selected pothole" />
          <div>
            <button type="button" className="button-secondary" onClick={() => onImage(null, null)}>
              Remove image
            </button>
          </div>
        </>
      ) : (
        <label className="upload-drop">
          <strong>Drop a road-damage image here</strong>
          <span>JPG, JPEG or PNG · maximum 10 MB</span>
          <input type="file" accept="image/png,image/jpeg" onChange={handleFileChange} />
          {error && <span className="auth-error" style={{ marginTop: '8px', display: 'block', color: 'var(--danger)' }}>{error}</span>}
          <em>Browse files</em>
        </label>
      )}
    </div>
  );
};
