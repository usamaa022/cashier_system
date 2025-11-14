// components/Card.js
export default function Card({ title, children, className = "" }) {
    return (
      <div className={`card ${className}`}>
        {title && <h2 className="text-xl font-semibold mb-4">{title}</h2>}
        {children}
      </div>
    );
  }
  