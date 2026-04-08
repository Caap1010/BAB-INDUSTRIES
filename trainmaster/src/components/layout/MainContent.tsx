import Sidebar from './Sidebar';

export default function MainContent({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                {children}
            </main>
        </div>
    );
}
