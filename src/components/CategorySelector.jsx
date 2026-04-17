import { CATEGORIES } from '../data/mockData';
import './CategorySelector.css';

export default function CategorySelector({ selected, onChange }) {
    const toggleCategory = (cat) => {
        let newSelected;
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
