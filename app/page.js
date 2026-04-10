import Link from "next/link";
import { 
  FaBox, 
  FaShoppingCart, 
  FaStore, 
  FaHistory, 
  FaChartLine,
  FaArrowRight,
  FaWarehouse,
  FaTags,
  FaDollarSign
} from "react-icons/fa";

export default function Home() {
  const summaryData = [
    { label: "Total Items", value: "156", icon: FaBox, color: "blue", change: "+12" },
    { label: "Low Stock", value: "8", icon: FaWarehouse, color: "orange", change: "-3" },
    // { label: Today\'s Sales", value: "$2,450", icon: FaDollarSign, color: "green", change: "+18%" },
    { label: "Monthly Revenue", value: "$45.2K", icon: FaChartLine, color: "purple", change: "+23%" },
  ];

  const navigationCards = [
    {
      href: "/items",
      title: "Items",
      description: "Manage product catalog",
      icon: FaBox,
      gradient: "from-blue-500 to-blue-600",
      lightGradient: "from-blue-50 to-blue-100",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      stats: "156 items"
    },
    {
      href: "/buying",
      title: "Purchasing",
      description: "Add stock to inventory",
      icon: FaShoppingCart,
      gradient: "from-emerald-500 to-teal-500",
      lightGradient: "from-emerald-50 to-teal-50",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      stats: "8 pending"
    },
    {
      href: "/selling",
      title: "Sales",
      description: "Process customer sales",
      icon: FaTags,
      gradient: "from-purple-500 to-pink-500",
      lightGradient: "from-purple-50 to-pink-50",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      stats: "12 today"
    },
    {
      href: "/store",
      title: "Store",
      description: "View store inventory",
      icon: FaStore,
      gradient: "from-orange-500 to-red-500",
      lightGradient: "from-orange-50 to-red-50",
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      stats: "3 locations"
    },
    {
      href: "/sold",
      title: "Sales History",
      description: "View old sales bills",
      icon: FaHistory,
      gradient: "from-rose-500 to-pink-500",
      lightGradient: "from-rose-50 to-pink-50",
      iconBg: "bg-rose-100",
      iconColor: "text-rose-600",
      stats: "245 transactions"
    },
    {
      href: "/analytics",
      title: "Analytics",
      description: "Track performance & revenue",
      icon: FaChartLine,
      gradient: "from-indigo-500 to-purple-600",
      lightGradient: "from-indigo-50 to-purple-50",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      stats: "View insights",
      isNew: true
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        {/* Header Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-blue-50 rounded-full border border-blue-200 mb-6">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></span>
          
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Medical Inventory
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Smart Inventory & Sales Management Dashboard
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {summaryData.map((item, index) => (
            <div
              key={index}
              className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl bg-${item.color}-50`}>
                  <item.icon className={`w-6 h-6 text-${item.color}-600`} />
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  item.change.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  {item.change}
                </span>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-800 mb-1">{item.value}</h3>
              <p className="text-sm text-gray-500">{item.label}</p>
              
              {/* Progress Bar */}
              <div className="mt-4 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-${item.color}-500 rounded-full transition-all duration-500 group-hover:w-full`}
                  style={{ width: `${Math.random() * 40 + 60}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {navigationCards.map((card, index) => (
            <Link
              key={index}
              href={card.href}
              className="group relative"
            >
              <div className={`relative bg-gradient-to-br ${card.lightGradient} rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-white/50 overflow-hidden`}>
                
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                
                {/* Header with Icon and Badge */}
                <div className="flex items-start justify-between mb-6">
                  <div className={`p-4 ${card.iconBg} rounded-xl group-hover:scale-110 transition-transform duration-300`}>
                    <card.icon className={`w-8 h-8 ${card.iconColor}`} />
                  </div>
                  
                  {card.isNew && (
                    <span className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold rounded-full">
                      NEW
                    </span>
                  )}
                </div>
                
                {/* Content */}
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-gray-900 transition-colors">
                    {card.title}
                  </h2>
                  <p className="text-gray-600 mb-6">
                    {card.description}
                  </p>
                  
                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500 bg-white/60 px-3 py-1 rounded-full">
                      {card.stats}
                    </span>
                    
                    <div className={`p-2 rounded-full bg-gradient-to-r ${card.gradient} text-white opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300`}>
                      <FaArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                
                {/* Gradient Overlay on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-r ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500 rounded-2xl`} />
              </div>
            </Link>
          ))}
        </div>

        {/* Footer Section */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-full shadow-md border border-gray-100">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full border-2 border-white"></div>
              <div className="w-8 h-8 bg-green-500 rounded-full border-2 border-white"></div>
              <div className="w-8 h-8 bg-purple-500 rounded-full border-2 border-white"></div>
            </div>
            <span className="text-gray-600">
              <span className="font-semibold text-gray-800">8 team members</span> are online
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}