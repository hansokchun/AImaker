import { CATEGORIES } from '../data/mockData';
import './CategorySelector.css';

interface CategorySelectorProps {
    selected: string[];
    onChange: (categories: string[]) => void;
}

export default function CategorySelector({ selected, onChange }: CategorySelectorProps) {
    const toggleCategory = (cat: string) => {
        let newSelected: string[];
        if (selected.includes(cat)) {
            newSelected = selected.filter(sc => sc !== cat);
        } else {
            newSelected = [...selected, cat];
        }
        onChange(newSelected);
    };

    return (
        <div className="selector-container">
            {CATEGORIES.map(cat => (
                <div 
                    key={cat}
                    className={`chip ${selected.includes(cat) ? 'active' : ''}`}
                    onClick={() => toggleCategory(cat)}
                >
                    {cat}
                </div>
            ))}
        </div>
    );
}
