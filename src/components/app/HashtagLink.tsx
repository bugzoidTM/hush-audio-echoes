
import { useNavigate } from 'react-router-dom';

interface HashtagLinkProps {
  hashtag: string;
  className?: string;
}

const HashtagLink = ({ hashtag, className = '' }: HashtagLinkProps) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Navegar para página de hashtag específica
    navigate(`/hashtag/${encodeURIComponent(hashtag.replace('#', ''))}`);
  };

  return (
    <span 
      onClick={handleClick}
      className={`text-primary cursor-pointer hover:underline font-medium ${className}`}
    >
      {hashtag}
    </span>
  );
};

export default HashtagLink;
