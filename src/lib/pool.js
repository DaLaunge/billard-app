export const POOL_COLORS = {
  1:"#E6B422",2:"#1F5FBF",3:"#C8102E",4:"#5B2A86",5:"#E8600F",6:"#1B7A43",7:"#7A2233",8:"#161616",
  9:"#E6B422",10:"#1F5FBF",11:"#C8102E",12:"#5B2A86",13:"#E8600F",14:"#1B7A43",15:"#7A2233",
};
export function poolBallStyle(n) {
  if (n === 0) return { background: "#E7E0CE" };
  const c = POOL_COLORS[n];
  if (n <= 8) return { background: c };
  return { background: `linear-gradient(180deg, #F2EDE0 0 30%, ${c} 30% 70%, #F2EDE0 70% 100%)` };
}

// Welche Kugel eine Disziplin im Bild vertritt (siehe widgets/DiscBall.jsx):
// die, nach der sie heisst. 14/1 endlos hat keine eigene Kugel, es wird mit
// allen 15 gespielt - die 14 steht dafuer, wie im Namen.
export const DISC_BALL = { "8 Ball": 8, "9 Ball": 9, "10 Ball": 10, "14/1 Endlos": 14 };
