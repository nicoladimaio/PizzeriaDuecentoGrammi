type MenuMobileTopbarProps = {
  searchValue: string;
  showSearch: boolean;
  activeFilterCount: number;
  searchAriaLabel: string;
  searchPlaceholder: string;
  titleLabel: string;
  openSearchLabel: string;
  openFiltersLabel: string;
  onToggleSearch: () => void;
  onToggleFilters: () => void;
  onSearchChange: (value: string) => void;
};

export function MenuMobileTopbar({
  searchValue,
  showSearch,
  activeFilterCount,
  searchAriaLabel,
  searchPlaceholder,
  titleLabel,
  openSearchLabel,
  openFiltersLabel,
  onToggleSearch,
  onToggleFilters,
  onSearchChange,
}: MenuMobileTopbarProps) {
  return (
    <header className="qr-topbar-wrap">
      <div className="qr-topbar">
        <div className="qr-brand" aria-label="Sezione menu">
          <span className="qr-brand-title">{titleLabel}</span>
        </div>

        <div className="qr-topbar-actions">
          <button
            type="button"
            className="qr-icon-btn"
            onClick={onToggleSearch}
            aria-label={openSearchLabel}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="11" cy="11" r="6" />
              <path d="M16 16L20 20" />
            </svg>
          </button>

          <button
            type="button"
            className="qr-filter-btn"
            onClick={onToggleFilters}
            aria-label={openFiltersLabel}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M4 6h16l-6.3 7.2V18l-3.4 1v-5.8z" />
            </svg>
            {activeFilterCount > 0 ? (
              <span className="qr-count-badge">{activeFilterCount}</span>
            ) : null}
          </button>
        </div>
      </div>

      <div className={showSearch ? "qr-search-row open" : "qr-search-row"}>
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
        />
      </div>
    </header>
  );
}
