#!/usr/bin/env perl
use strict;
use warnings;

foreach my $file (@ARGV) {
    open(my $fh, '<', $file) or die "Cannot open $file: $!";
    my $content = do { local $/; <$fh> };
    close($fh);
    
    my $original = $content;
    
    # Fix pattern: throw new Exception('message', {\n  field: 'name'\n})
    $content =~ s/
        (throw\s+new\s+(?:ValidationException|NotFoundException)\s*\(\s*'[^']+'\s*,\s*)
        \{\s*
        field:\s*'([^']+)'\s*
        \}
    /$ {1}'$2'/gsx;
    
    if ($content ne $original) {
        open(my $out, '>', $file) or die "Cannot write $file: $!";
        print $out $content;
        close($out);
        print "Fixed: $file\n";
    }
}
