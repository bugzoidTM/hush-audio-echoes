
interface SimplePostDescriptionProps {
  description: string | null | undefined;
}

const SimplePostDescription = ({ description }: SimplePostDescriptionProps) => {
  const renderDescription = (text: string | null | undefined) => {
    if (!text) return 'Sem descrição';
    
    return text.split(/(\s+)/).map((word, index) => {
      if (word.startsWith('#')) {
        return (
          <span key={index} className="text-blue-500 font-medium">
            {word}
          </span>
        );
      }
      return word;
    });
  };

  return (
    <p className="text-sm leading-relaxed">
      {renderDescription(description)}
    </p>
  );
};

export default SimplePostDescription;
