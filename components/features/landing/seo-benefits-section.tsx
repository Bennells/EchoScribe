import { TrendingUp, Users, Globe, Zap } from "lucide-react";

const benefits = [
  {
    icon: TrendingUp,
    title: "Better Rankings",
    description:
      "Meta tags and keywords help Google understand your content and rank it higher.",
  },
  {
    icon: Users,
    title: "More Listeners",
    description:
      "People find your podcasts through Google search – reach new audiences.",
  },
  {
    icon: Globe,
    title: "Greater Reach",
    description:
      "Social media posts automatically distribute your content across all major channels.",
  },
  {
    icon: Zap,
    title: "Save Time",
    description:
      "Instead of hours for content creation – ready in minutes. More time for podcasting.",
  },
];

export function SeoBenefitsSection() {
  return (
    <section className="py-20 md:py-32 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold">
            Why{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              SEO-Optimized Articles
            </span>{" "}
            are important for podcasters
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Most listeners discover new podcasts through Google, not through podcast apps.
            With SEO-optimized articles, you tap into this huge audience.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="text-center space-y-4"
              >
                <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-600/10 to-violet-600/10 flex items-center justify-center">
                  <Icon className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{benefit.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Stats or Additional Info */}
        <div className="mt-16 bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl p-8 md:p-12 text-white text-center">
          <h3 className="text-3xl md:text-4xl font-bold mb-4">
            Most Podcast Listeners
          </h3>
          <p className="text-xl md:text-2xl opacity-90 max-w-2xl mx-auto">
            search on Google first for podcasts about their interests.
            Be visible where your target audience is searching.
          </p>
        </div>
      </div>
    </section>
  );
}
