import './Button.css';

// variant: primary | outline | link | icon | sm
export default function Button({ variant = 'primary', className = '', children, ...rest }) {
  return (
    <button className={`btn btn--${variant} ${className}`} {...rest}>
      {children}
    </button>
  );
}
