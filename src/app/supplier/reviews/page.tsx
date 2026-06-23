'use client';

import { useState } from 'react';
import { Star, ChatCircle } from '@phosphor-icons/react';

const MOCK_REVIEWS = [
  { id: 1, builder: 'Tafadzwa M.', project: 'Harare Residential Build', rating: 5, comment: 'Excellent service and fast delivery. Cement quality was top notch.', date: '2026-03-20', replied: false },
  { id: 2, builder: 'Sithembile N.', project: 'Bulawayo Office Block', rating: 4, comment: 'Good steel quality but delivery took 3 extra days. Would use again.', date: '2026-03-15', replied: true, reply: 'Thank you for your feedback! We apologise for the delay and will improve our logistics.' },
  { id: 3, builder: 'Chiedza P.', project: 'Masvingo Townhouse', rating: 5, comment: 'Best roofing supplier in Zim. Sheets were perfect gauge and on time.', date: '2026-03-10', replied: false },
  { id: 4, builder: 'Amos K.', project: 'Gweru Warehouse', rating: 3, comment: 'Bricks were slightly undersized compared to spec. Price was fair though.', date: '2026-03-05', replied: false },
];

const avgRating = (MOCK_REVIEWS.reduce((s, r) => s + r.rating, 0) / MOCK_REVIEWS.length).toFixed(1);

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span style={{ color: '#f59e0b', fontSize: size }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

export default function SupplierReviewsPage() {
  const [replyId, setReplyId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [reviews, setReviews] = useState(MOCK_REVIEWS);
  const [filter, setFilter] = useState(0); // 0 = all

  const filtered = reviews.filter(r => filter === 0 || r.rating === filter);

  const submitReply = (id: number) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, replied: true, reply: replyText } : r));
    setReplyId(null);
    setReplyText('');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="header-left">
          <Star size={22} weight="duotone" className="page-icon" />
          <div>
            <h1>Reviews & Ratings</h1>
            <p>See what builders say and respond to feedback</p>
          </div>
        </div>
      </div>

      <div className="rating-summary">
        <div className="big-rating">{avgRating}</div>
        <div className="rating-stars"><StarRating rating={Math.round(Number(avgRating))} size={24} /></div>
        <div className="rating-count">Based on {reviews.length} reviews</div>
        <div className="rating-bars">
          {[5, 4, 3, 2, 1].map(n => {
            const count = reviews.filter(r => r.rating === n).length;
            const pct = (count / reviews.length) * 100;
            return (
              <div key={n} className="rating-bar-row">
                <span className="star-num">{n}★</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
                <span className="bar-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="filter-bar">
        {[0, 5, 4, 3, 2, 1].map(n => (
          <button key={n} className={`filter-btn ${filter === n ? 'active' : ''}`} onClick={() => setFilter(n)}>
            {n === 0 ? 'All' : `${n}★`}
          </button>
        ))}
      </div>

      <div className="reviews-list">
        {filtered.map(r => (
          <div key={r.id} className="review-card">
            <div className="review-top">
              <div className="reviewer-avatar">{r.builder[0]}</div>
              <div className="reviewer-info">
                <div className="reviewer-name">{r.builder}</div>
                <div className="reviewer-project">{r.project}</div>
              </div>
              <div className="review-meta">
                <StarRating rating={r.rating} />
                <div className="review-date">{r.date}</div>
              </div>
            </div>
            <div className="review-comment">{r.comment}</div>

            {r.replied && r.reply && (
              <div className="reply-block">
                <span className="reply-label">Your reply</span>
                <div className="reply-text">{r.reply}</div>
              </div>
            )}

            {!r.replied && (
              replyId === r.id ? (
                <div className="reply-form">
                  <textarea
                    className="reply-input"
                    placeholder="Write a professional reply..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    rows={3}
                  />
                  <div className="reply-actions">
                    <button className="btn-reply" onClick={() => submitReply(r.id)} disabled={!replyText.trim()}>Post Reply</button>
                    <button className="btn-cancel" onClick={() => { setReplyId(null); setReplyText(''); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="btn-reply-trigger" onClick={() => setReplyId(r.id)}>
                  <ChatCircle size={14} /> Reply
                </button>
              )
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .page { padding: 28px 32px; max-width: 800px; }
        .page-header { display: flex; align-items: flex-start; margin-bottom: 24px; gap: 12px; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .page-icon { color: #f59e0b; }
        h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 2px; }
        p { font-size: 0.8125rem; color: #64748b; margin: 0; }
        .rating-summary { background: white; border-radius: 14px; border: 1px solid #e2e8f0; padding: 24px 28px; margin-bottom: 20px; display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
        .big-rating { font-size: 3rem; font-weight: 800; color: #0f172a; line-height: 1; }
        .rating-count { font-size: 0.8125rem; color: #94a3b8; }
        .rating-bars { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 4px; }
        .rating-bar-row { display: flex; align-items: center; gap: 8px; font-size: 0.75rem; }
        .star-num { width: 20px; color: #f59e0b; font-weight: 600; }
        .bar-track { flex: 1; height: 7px; background: #f1f5f9; border-radius: 10px; overflow: hidden; }
        .bar-fill { height: 100%; background: #f59e0b; border-radius: 10px; transition: width 0.3s; }
        .bar-count { width: 16px; color: #94a3b8; }
        .filter-bar { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .filter-btn { background: white; border: 1px solid #e2e8f0; border-radius: 20px; padding: 5px 14px; font-size: 0.8rem; cursor: pointer; color: #64748b; font-weight: 500; }
        .filter-btn.active { background: #eff6ff; border-color: #93c5fd; color: #2563eb; font-weight: 600; }
        .reviews-list { display: flex; flex-direction: column; gap: 12px; }
        .review-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 22px; }
        .review-top { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
        .reviewer-avatar { width: 38px; height: 38px; background: #eff6ff; color: #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.875rem; flex-shrink: 0; }
        .reviewer-info { flex: 1; }
        .reviewer-name { font-size: 0.9rem; font-weight: 700; color: #0f172a; }
        .reviewer-project { font-size: 0.75rem; color: #64748b; }
        .review-meta { text-align: right; }
        .review-date { font-size: 0.75rem; color: #94a3b8; margin-top: 3px; }
        .review-comment { font-size: 0.875rem; color: #374151; line-height: 1.55; margin-bottom: 14px; }
        .reply-block { background: #f8fafc; border-left: 3px solid #2563eb; border-radius: 0 8px 8px 0; padding: 12px 14px; }
        .reply-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #2563eb; display: block; margin-bottom: 5px; }
        .reply-text { font-size: 0.8375rem; color: #374151; }
        .reply-form { margin-top: 4px; }
        .reply-input { width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; font-size: 0.8375rem; color: #1e293b; outline: none; resize: none; font-family: inherit; }
        .reply-input:focus { border-color: #93c5fd; }
        .reply-actions { display: flex; gap: 8px; margin-top: 8px; }
        .btn-reply { background: #2563eb; color: white; border: none; border-radius: 7px; padding: 7px 14px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
        .btn-reply:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-cancel { background: white; color: #64748b; border: 1px solid #e2e8f0; border-radius: 7px; padding: 7px 14px; font-size: 0.8125rem; cursor: pointer; }
        .btn-reply-trigger { display: flex; align-items: center; gap: 5px; background: none; border: 1px solid #e2e8f0; border-radius: 7px; padding: 6px 12px; font-size: 0.8rem; color: #64748b; cursor: pointer; margin-top: 4px; }
        .btn-reply-trigger:hover { background: #f8fafc; color: #2563eb; }
      `}</style>
    </div>
  );
}
