import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import CategorySelector from '../components/CategorySelector';
import type { ServiceRequestData } from '../types';
import './ServiceRequest.css';

export default function ServiceRequest() {
    const navigate = useNavigate();
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [title, setTitle] = useState<string>('');
    const [desc, setDesc] = useState<string>('');
    const [budget, setBudget] = useState<string>('');
    const [deadline, setDeadline] = useState<string>('');

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (selectedCategories.length === 0) {
            alert('최소 하나 이상의 카테고리를 선택해주세요.');
            return;
        }

        const newRequest: ServiceRequestData = {
            id: Date.now(),
            title,
            desc,
            budget,
            deadline,
            categories: selectedCategories,
            createdAt: new Date().toLocaleDateString(),
            status: 'pending'
        };

        const existingRequests: ServiceRequestData[] = JSON.parse(localStorage.getItem('ai_requests') || '[]');
        existingRequests.push(newRequest);
        localStorage.setItem('ai_requests', JSON.stringify(existingRequests));

        alert('요청서가 성공적으로 등록되었습니다!');
        navigate('/requests');
    };

    return (
        <div style={{ overflowY: 'auto' }}>
            <div className="page-hero" style={{ paddingBottom: '80px', paddingTop: '100px' }}>
                <div className="container">
                    <h1 className="page-title" style={{ marginBottom: 0 }}>서비스 요청</h1>
                </div>
            </div>

            <main className="container" style={{ marginTop: '-30px', paddingBottom: '100px', position: 'relative', zIndex: 10, minHeight: '600px' }}>
                <div className="content-card" style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <form onSubmit={handleSubmit} id="request-form">
                        <div className="form-group">
                            <label><span className="material-symbols-outlined">category</span> 카테고리 선택 (중복 선택 가능)</label>
                            <CategorySelector selected={selectedCategories} onChange={setSelectedCategories} />
                        </div>

                        <div className="form-group">
                            <label><span className="material-symbols-outlined">edit_note</span> 어떤 서비스가 필요하신가요?</label>
                            <input 
                                type="text" 
                                className="form-control" 
                                placeholder="예: 로고 디자인, 파이썬 웹 크롤러 개발" 
                                required 
                                value={title}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label><span className="material-symbols-outlined">description</span> 상세 내용</label>
                            <textarea 
                                className="form-control" 
                                rows={8} 
                                placeholder="전문가가 파악할 수 있도록 프로젝트의 목적, 요구사항, 참고 자료 등을 구체적으로 작성해주세요." 
                                required
                                value={desc}
                                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDesc(e.target.value)}
                            ></textarea>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label><span className="material-symbols-outlined">payments</span> 희망 예산 (원)</label>
                                <input 
                                    type="number" 
                                    className="form-control" 
                                    placeholder="예: 500000" 
                                    required 
                                    value={budget}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setBudget(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label><span className="material-symbols-outlined">event_available</span> 마감 기한</label>
                                <input 
                                    type="date" 
                                    className="form-control" 
                                    required 
                                    value={deadline}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDeadline(e.target.value)}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '1.25rem', fontSize: '1.2rem', borderRadius: 'var(--radius-xl)' }}>
                                요청서 올리기
                            </button>
                            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
                                요청서를 올리면 관련 분야 전문가들에게 알림이 전송됩니다.
                            </p>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
