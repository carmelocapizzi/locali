// Barre de navigation — n'affiche QUE les onglets autorisés pour le rôle.
export default function BottomNav({ items, active, onChange }) {
  return (
    <nav className="bottomnav">
      {items.map((it) => (
        <button
          key={it.key}
          className={'navbtn' + (active === it.key ? ' active' : '')}
          onClick={() => onChange(it.key)}
        >
          <i className={'ti ' + it.icon} />
          {it.badge ? <div className="bnotif">{it.badge}</div> : null}
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}
