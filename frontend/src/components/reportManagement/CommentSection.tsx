// Local-only comment interface that is ready to connect to a discussion API.
import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { addComment, listComments } from '../../services/reportManagementService';
import type { ReportComment } from '../../types/reportManagement';

export const CommentSection = ({ reportId }: { reportId: string }) => {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(() => {
    setLoading(true);
    setError(null);
    listComments(reportId)
      .then((data) => {
        setComments(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load comments');
        setLoading(false);
      });
  }, [reportId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!comment.trim()) return;
    try {
      const newComment = await addComment(reportId, comment);
      setComments((current) => [...current, newComment]);
      setComment('');
    } catch (err: any) {
      alert(err.message || 'Failed to post comment');
    }
  };

  return (
    <section className="detail-section">
      <h2>Comments</h2>
      {loading && <p style={{ color: 'var(--muted)' }}>Loading comments...</p>}
      {error && <p style={{ color: 'var(--error)' }}>Error: {error}</p>}
      
      {!loading && !error && comments.length === 0 && (
        <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>No comments yet. Be the first to start the discussion!</p>
      )}

      {!loading && !error && comments.map((item, index) => (
        <article className="comment" key={item.id || `${item.author}-${item.timestamp}-${index}`}>
          <span>{item.initials}</span>
          <div>
            <strong>
              {item.author} <small>{item.role}</small>
            </strong>
            <p>{item.message}</p>
            <time>{item.timestamp}</time>
          </div>
        </article>
      ))}

      <form className="comment-form" onSubmit={submit}>
        <label htmlFor="comment">Add a comment</label>
        <textarea 
          id="comment" 
          value={comment} 
          onChange={(event) => setComment(event.target.value)} 
          placeholder="Share an update or question" 
        />
        <button className="button-primary">Send</button>
      </form>
    </section>
  );
};

