import { SearchIcon } from "./Icons";

export function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="search-bar">
      <span className="visually-hidden">商品検索</span>
      <SearchIcon />
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder="すべての項目を検索" />
    </label>
  );
}
