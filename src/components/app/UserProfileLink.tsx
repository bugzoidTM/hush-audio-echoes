
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface UserProfileLinkProps {
  userId: string;
  username?: string;
  children: ReactNode;
  className?: string;
}

const UserProfileLink = ({ userId, username, children, className = "" }: UserProfileLinkProps) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/user/${userId}`);
  };

  return (
    <button 
      onClick={handleClick}
      className={`hover:underline text-left ${className}`}
    >
      {children}
    </button>
  );
};

export default UserProfileLink;
