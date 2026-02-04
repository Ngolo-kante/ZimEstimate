# ZimEstimate Development Lessons & Patterns

This file captures key learnings from development sessions to avoid repeating mistakes.

---

## Supabase Migrations

### Always Use Safe Migration Patterns
```sql
-- Tables: Use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS my_table (...);

-- Columns: Use IF NOT EXISTS
ALTER TABLE projects ADD COLUMN IF NOT EXISTS my_column DATE;

-- Indexes: Use IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_name ON table(column);

-- Policies: DROP first, then CREATE (no IF NOT EXISTS for policies)
DROP POLICY IF EXISTS "Policy name" ON table_name;
CREATE POLICY "Policy name" ON table_name ...;

-- Functions: Use CREATE OR REPLACE, but if changing parameter names:
DROP FUNCTION IF EXISTS function_name CASCADE;
CREATE FUNCTION function_name(...) ...;
```

### Common Errors
- **42710 "already exists"**: Object exists, use IF NOT EXISTS or DROP first
- **42P13 "cannot change name of input parameter"**: Must DROP FUNCTION first, then CREATE
- Use `CASCADE` when dropping functions that have dependent policies

---

## TypeScript Patterns

### Multi-Select Array Handling
When a field can be single value OR array:
```typescript
// Type definition
type ConfigValue<T> = T | T[];

// Helper to normalize
function getFirstValue<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

// Usage in calculations - always normalize before using
const scope = getFirstValue(config.scope);
```

### Error Object Type Casting
Supabase errors may have a `code` property not on standard Error:
```typescript
// Wrong - TypeScript error
if (error.code === 'PGRST116') ...

// Correct
if ((error as Error & { code?: string }).code === 'PGRST116') ...
```

### Reduce with Explicit Types
```typescript
// Wrong - implicit any
records.reduce((sum, r) => sum + r.quantity, 0)

// Correct
records.reduce((sum: number, r: { quantity: number }) => sum + r.quantity, 0)
```

---

## React Patterns

### Auto-Refresh on Window Focus
```typescript
const loadData = useCallback(async (showLoading = true) => {
  if (showLoading) setIsLoading(true);
  // ... fetch data
  if (showLoading) setIsLoading(false);
}, []);

// Refresh when user returns to tab
useEffect(() => {
  const handleFocus = () => loadData(false);
  window.addEventListener('focus', handleFocus);
  return () => window.removeEventListener('focus', handleFocus);
}, [loadData]);

// Optional: periodic refresh
useEffect(() => {
  const interval = setInterval(() => loadData(false), 30000);
  return () => clearInterval(interval);
}, [loadData]);
```

### Click Outside to Close Dropdown
```typescript
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-container')) {
      setShowMenu(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

### Confetti Animation Pattern
```typescript
const [showConfetti, setShowConfetti] = useState(false);

const handleSuccess = () => {
  setShowConfetti(true);
  setTimeout(() => setShowConfetti(false), 2500);
};

// JSX
{showConfetti && (
  <div className="confetti-container">
    {[...Array(30)].map((_, i) => (
      <div key={i} className="confetti-piece" style={{
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 0.5}s`,
        backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      }} />
    ))}
  </div>
)}
```

---

## UI/UX Patterns

### Table Styling
- Use `font-medium` instead of `font-bold` for table content
- Hide decorative icons in dense tables for cleaner look
- Use dropdown menus for multiple actions (Share, Export)

### Date Fields with Status Badges
```typescript
const getDaysRemaining = (dateStr: string | null): number | null => {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

// Show "X days remaining" or "X days ago" with color coding
// Blue for future, Red for past
```

### Multi-Select with Constraints
When one option disables others (e.g., "Full House" disables individual scopes):
```typescript
const handleScopeChange = (scope: string) => {
  if (scope === 'entire_house') {
    setSelectedScopes(['entire_house']); // Only this one
  } else {
    // Remove 'entire_house' if selecting individual scopes
    setSelectedScopes(prev =>
      prev.filter(s => s !== 'entire_house').includes(scope)
        ? prev.filter(s => s !== scope)
        : [...prev.filter(s => s !== 'entire_house'), scope]
    );
  }
};
```

---

## Export Patterns

### CSV Export (Excel Compatible)
```typescript
const exportToCSV = (items: Item[]) => {
  const headers = ['Name', 'Quantity', 'Unit', 'Price'];
  const rows = items.map(item => [item.name, item.qty, item.unit, item.price]);
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  downloadFile(csv, 'export.csv', 'text/csv');
};
```

### Text Export (Word Compatible)
```typescript
const exportToText = (items: Item[]) => {
  let content = 'BILL OF QUANTITIES\n\n';
  items.forEach(item => {
    content += `${item.name}: ${item.qty} ${item.unit} @ $${item.price}\n`;
  });
  downloadFile(content, 'export.txt', 'text/plain');
};
```

---

## Database Schema Notes

### Projects Table Columns
- `start_date` - When construction begins
- `target_completion_date` - Project finish goal
- `target_purchase_date` - When all materials should be bought
- `savings_frequency` - 'weekly' | 'monthly' | 'quarterly'
- `budget_target_usd` - Total budget goal

### BOQ Items Tracking Fields
- `actual_quantity` - What was actually purchased
- `actual_price_usd` - What was actually paid
- `is_purchased` - Boolean flag
- `purchased_date` - When it was bought

---

## File Organization

### Component Structure
```
src/components/
├── ui/                    # Reusable UI components
├── projects/              # Project-specific components
│   ├── DocumentsTab.tsx
│   ├── PlanningTab.tsx
│   ├── UsageTab.tsx
│   └── SavingsCalculator.tsx
└── vision-takeoff/        # AI vision feature components
```

### Service Functions
All Supabase operations go in `src/lib/services/projects.ts`:
- Fetch functions return `{ data, error }`
- Always handle errors gracefully
- Use TypeScript types from `database.types.ts`

---

## Common Mistakes to Avoid

1. **Don't run SQL comments as code** - Copy only the SQL statements
2. **Don't use `git add -A`** - Add specific files to avoid committing secrets
3. **Don't forget cleanup in useEffect** - Always return cleanup function
4. **Don't mutate state directly** - Use spread operator or functional updates
5. **Don't skip TypeScript errors** - Fix them, don't use `any`
6. **Don't hardcode API keys** - Use environment variables

---

## Design System (Benti)

- Primary accent: `#4E9AF7` (blue)
- Navy background: `#06142F`
- Use Phosphor icons consistently
- Card styling: `bg-white rounded-xl shadow-sm border`
- Button primary: `bg-[#4E9AF7] hover:bg-[#3d89e6] text-white`
