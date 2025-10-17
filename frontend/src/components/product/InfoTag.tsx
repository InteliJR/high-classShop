// src/components/product/InfoTag.tsx
interface InfoTagProps {
  label: string;
  value: string | number;
}

const InfoTag = ({ label, value }: InfoTagProps) => (
  <div className="bg-gray-200/50 px-3 py-1 rounded-md text-sm border">
    <span className="font-semibold text-gray-800">{label}: </span>
    <span className="text-gray-600">{value}</span>
  </div>
);

export default InfoTag;