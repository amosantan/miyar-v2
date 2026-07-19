import { Streamdown } from "streamdown";

type MarkdownRendererProps = {
  children: string;
};

export default function MarkdownRenderer({ children }: MarkdownRendererProps) {
  return <Streamdown>{children}</Streamdown>;
}
