export function Card({ className = "", children, ...props }) {
  return <div className={`surface ${className}`.trim()} {...props}>{children}</div>;
}

export function CardHeader({ className = "", children, ...props }) {
  return <div className={`section-header ${className}`.trim()} {...props}>{children}</div>;
}

export function CardTitle({ className = "", children, ...props }) {
  return <h2 className={`section-title ${className}`.trim()} {...props}>{children}</h2>;
}

export function CardContent({ className = "", children, ...props }) {
  return <div className={`section-content ${className}`.trim()} {...props}>{children}</div>;
}

export function Button({ className = "", children, ...props }) {
  return (
    <button className={`ui-button ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }) {
  return <input className={`ui-input ${className}`.trim()} {...props} />;
}

export function Progress({ value = 0, className = "", ...props }) {
  return (
    <div className={`progress-track ${className}`.trim()} {...props}>
      <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
