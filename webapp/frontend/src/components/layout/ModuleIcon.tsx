import React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  CreditCard,
  Database,
  FileSpreadsheet,
  Landmark,
  Layers,
  Package,
  RotateCcw,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import { NavModuleItem } from "../../config/accountingModules";

export const ModuleIcon: React.FC<{
  name: NavModuleItem["iconName"];
  className?: string;
}> = ({ name, className = "w-4 h-4" }) => {
  switch (name) {
    case "arrow-down-left":
      return <ArrowDownLeft className={className} />;
    case "arrow-up-right":
      return <ArrowUpRight className={className} />;
    case "landmark":
      return <Landmark className={className} />;
    case "building-2":
      return <Building2 className={className} />;
    case "book-open":
      return <BookOpen className={className} />;
    case "file-spreadsheet":
      return <FileSpreadsheet className={className} />;
    case "rotate-ccw":
      return <RotateCcw className={className} />;
    case "warehouse":
      return <Warehouse className={className} />;
    case "credit-card":
      return <CreditCard className={className} />;
    case "shopping-cart":
      return <ShoppingCart className={className} />;
    case "package":
      return <Package className={className} />;
    case "layers":
      return <Layers className={className} />;
    case "calculator":
      return <Calculator className={className} />;
    case "bar-chart-3":
      return <BarChart3 className={className} />;
    case "database":
      return <Database className={className} />;
    default:
      return <FileSpreadsheet className={className} />;
  }
};
