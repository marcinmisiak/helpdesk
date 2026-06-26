import { avatarUrl } from '../utils/avatarUrl';

export default function Avatar({ imie, nazwisko, avatarPath, className = 'w-10 h-10 text-sm' }) {
  const url = avatarUrl(avatarPath);
  const initials = [imie, nazwisko].filter(Boolean).map((s) => s[0].toUpperCase()).join('');
  const name = [imie, nazwisko].filter(Boolean).join(' ');

  if (url) {
    return (
      <img
        src={url}
        alt={name || 'avatar'}
        className={`${className} rounded-full object-cover flex-shrink-0 bg-gray-200`}
      />
    );
  }

  return (
    <div
      title={name || undefined}
      className={`${className} rounded-full bg-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0 select-none`}
    >
      {initials || '?'}
    </div>
  );
}
