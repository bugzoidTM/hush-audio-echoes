
import HashtagLink from './HashtagLink';

interface SimplePostDescriptionProps {
  description: string;
}

const SimplePostDescription = ({ description }: SimplePostDescriptionProps) => {
  if (!description) return null;

  // Função para processar texto e tornar hashtags clicáveis
  const processDescription = (text: string) => {
    const parts = text.split(/(\#\w+)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('#')) {
        return <HashtagLink key={index} hashtag={part} />;
      }
      return part;
    });
  };

  return (
    <div className="text-sm text-muted-foreground">
      {processDescription(description)}
    </div>
  );
};

export default SimplePostDescription;
