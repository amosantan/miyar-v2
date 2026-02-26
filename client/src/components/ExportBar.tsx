import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { exportToCSV, exportToPDF, exportToJSON } from "@/lib/export";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ExportBarProps {
    /** Data array to export as CSV/JSON */
    data?: Record<string, unknown>[];
    /** Filename without extension */
    filename: string;
    /** ID of the DOM element to capture for PDF export */
    pdfElementId?: string;
    /** Title shown on the PDF export */
    pdfTitle?: string;
}

export function ExportBar({ data, filename, pdfElementId, pdfTitle }: ExportBarProps) {
    const hasData = data && data.length > 0;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {hasData && (
                    <>
                        <DropdownMenuItem
                            onClick={() => exportToCSV(data, filename)}
                            className="cursor-pointer gap-2"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            Export CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => exportToJSON(data, filename)}
                            className="cursor-pointer gap-2"
                        >
                            <FileText className="h-4 w-4" />
                            Export JSON
                        </DropdownMenuItem>
                    </>
                )}
                {pdfElementId && (
                    <DropdownMenuItem
                        onClick={() => exportToPDF(pdfTitle || filename, pdfElementId)}
                        className="cursor-pointer gap-2"
                    >
                        <FileText className="h-4 w-4" />
                        Export PDF
                    </DropdownMenuItem>
                )}
                {!hasData && !pdfElementId && (
                    <DropdownMenuItem disabled>
                        No data to export
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
