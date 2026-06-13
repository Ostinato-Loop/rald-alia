import { Sidebar } from '@/components/Sidebar';

export default function ProjectsPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white">Projects</h1>
            <p className="text-[#555] text-sm mt-1">Organize your integrations by project</p>
          </div>
          <button className="bg-[#D90429] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#b8001f] transition-colors">
            + New Project
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-6 border-2 border-dashed border-[#1e1e1e] rounded-xl flex flex-col items-center justify-center gap-3 text-center hover:border-[#D90429]/30 transition-colors cursor-pointer min-h-[180px]">
            <span className="text-3xl">+</span>
            <p className="text-sm text-[#555]">Create your first project</p>
          </div>
        </div>

        <div className="mt-8 p-5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
          <h3 className="text-white font-medium mb-2">What is a project?</h3>
          <p className="text-sm text-[#B8BCC8]">Projects let you separate API keys, webhooks, and usage by product or environment. For example, you might have a "Mobile App" project and a "Web Checkout" project — each with their own credentials and event streams.</p>
        </div>
      </main>
    </div>
  );
}
