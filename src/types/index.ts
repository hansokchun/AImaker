// ===== Expert =====
export interface Expert {
    id: number;
    name: string;
    prof: string;
    rate: number;
    price: number;
    img: string;
}

// ===== Service Request =====
export interface ServiceRequestData {
    id: number;
    title: string;
    desc: string;
    budget: string;
    deadline: string;
    categories: string[];
    createdAt: string;
    status: 'pending' | 'in_progress' | 'completed';
}

// ===== Chat =====
export interface ChatMessage {
    type: 'system' | 'expert' | 'user';
    text: string;
}

// ===== Auth Context =====
export interface AuthContextType {
    session: import('@supabase/supabase-js').Session | null;
    user: import('@supabase/supabase-js').User | null;
    loading: boolean;
    signOut: () => Promise<void>;
}
