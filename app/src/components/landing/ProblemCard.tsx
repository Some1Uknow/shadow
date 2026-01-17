export function ProblemCard({ title, description }: { title: string; description: string }) {
    return (
        <div className="p-6 rounded-2xl bg-black/30 hover:bg-black/40 transition-all duration-300">
            <h3 className="text-lg font-medium text-white/90 mb-2">{title}</h3>
            <p className="text-white/50 text-sm leading-relaxed">{description}</p>
        </div>
    );
}
