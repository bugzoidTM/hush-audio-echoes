
import HashtagLink from './HashtagLink';

interface ShhhhAudioPostContentProps {
  post: {
    title?: string;
    description?: string;
  };
}

const ShhhhAudioPostContent = ({ post }: ShhhhAudioPostContentProps) => {
  const processDescription = (text: string) => {
    if (!text) return null;
    
    const parts = text.split(/(\#\w+)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return <HashtagLink key={index} hashtag={part} />;
      }
      return part;
    });
  };

  return (
    <div className="px-4 pb-3">
      {post.title && (
        <h3 className="font-semibold text-sm mb-1">{post.title}</h3>
      )}
      {post.description && (
        <div className="text-sm text-muted-foreground mb-3">
          {processDescription(post.description)}
        </div>
      )}
    </div>
  );
};

export default ShhhhAudioPostContent;
