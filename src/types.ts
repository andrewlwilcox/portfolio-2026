export interface Project {
  id: string;
  client?: string;
  title: string;
  strategy_line?: string;
  overview?: string;
  results?: string;
  videos?: string[];
  video_caption?: string;
  gallery_images?: string[];
  images?: string[];
  category: string;
  role: string;
  year: string;
  hoverBgColor?: string;
  hoverGifUrl?: string;
}
